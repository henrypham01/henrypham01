import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const returnSchema = z.object({
  reason: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().gt(0),
        costPrice: z.coerce.number().min(0),
      })
    )
    .min(1, "Cần ít nhất 1 mặt hàng trả"),
});

async function generateNextCode(
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  const last = await db.purchaseReturn.findFirst({
    where: { code: { startsWith: "PT" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const num = parseInt(last.code.replace(/^PT/, ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `PT${String(next).padStart(6, "0")}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const session = await getSession();

  // Verify order exists and is COMPLETED
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      returns: { include: { items: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Chỉ trả hàng được phiếu đã Hoàn thành" },
      { status: 400 }
    );
  }

  // Calculate already-returned quantities per product (Decimal for safety)
  const returnedQty: Record<string, Decimal> = {};
  for (const ret of order.returns) {
    for (const ri of ret.items) {
      const prev = returnedQty[ri.productId] ?? new Decimal(0);
      returnedQty[ri.productId] = prev.add(new Decimal(ri.quantity.toString()));
    }
  }

  // Validate return quantities
  for (const item of parsed.data.items) {
    const origItem = order.items.find((i) => i.productId === item.productId);
    if (!origItem) {
      return NextResponse.json(
        { error: `Sản phẩm ${item.productId} không có trong phiếu nhập` },
        { status: 400 }
      );
    }
    const origQty = new Decimal(origItem.quantity.toString());
    const alreadyReturned = returnedQty[item.productId] ?? new Decimal(0);
    const maxReturnable = origQty.sub(alreadyReturned);
    if (new Decimal(item.quantity).gt(maxReturnable)) {
      return NextResponse.json(
        {
          error: `Số lượng trả vượt quá cho phép (tối đa ${maxReturnable.toNumber()})`,
        },
        { status: 400 }
      );
    }
  }

  const totalAmountDec = parsed.data.items.reduce(
    (s, i) => s.add(new Decimal(i.quantity).mul(new Decimal(i.costPrice))),
    new Decimal(0)
  );

  try {
    const { purchaseReturn } = await prisma.$transaction(async (tx) => {
      const code = await generateNextCode(tx);

      const ret = await tx.purchaseReturn.create({
        data: {
          code,
          purchaseOrder: { connect: { id } },
          reason: parsed.data.reason || null,
          totalAmount: totalAmountDec.toNumber(),
          ...(session?.userId && {
            createdBy: { connect: { id: session.userId } },
          }),
          items: {
            create: parsed.data.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              costPrice: it.costPrice,
              lineTotal: new Decimal(it.quantity)
                .mul(new Decimal(it.costPrice))
                .toNumber(),
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Reverse stock for each returned item, keeping balance{Qty,Cost}
      // consistent with the running ledger in stock_movements.
      for (const item of parsed.data.items) {
        const lastMovement = await tx.stockMovement.findFirst({
          where: { productId: item.productId },
          orderBy: { movementDate: "desc" },
        });

        const prevBalanceQty = lastMovement
          ? new Decimal(lastMovement.balanceQty.toString())
          : new Decimal(0);
        const prevBalanceCost = lastMovement
          ? new Decimal(lastMovement.balanceCost.toString())
          : new Decimal(0);

        // Weighted-average unit cost at the time of the return. This is the
        // correct value basis to remove from inventory — NOT the (possibly
        // edited) product.costPrice column.
        const avgCost = prevBalanceQty.gt(0)
          ? prevBalanceCost.div(prevBalanceQty)
          : new Decimal(0);

        const qty = new Decimal(item.quantity);
        const valueRemoved = qty.mul(avgCost);
        const newBalanceQty = Decimal.max(0, prevBalanceQty.sub(qty));
        const newBalanceCost = Decimal.max(0, prevBalanceCost.sub(valueRemoved));

        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: newBalanceQty.toNumber() },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            purchaseOrderId: id,
            movementType: "STOCK_OUT",
            quantity: qty.toNumber(),
            unitCost: avgCost.toNumber(),
            totalCost: valueRemoved.toNumber(),
            balanceQty: newBalanceQty.toNumber(),
            balanceCost: newBalanceCost.toNumber(),
            notes: `Trả hàng từ phiếu ${order.code} - ${code}`,
          },
        });
      }

      // Check if fully returned → update order status (still inside tx)
      const updatedReturnedQty: Record<string, Decimal> = { ...returnedQty };
      for (const item of parsed.data.items) {
        const prev = updatedReturnedQty[item.productId] ?? new Decimal(0);
        updatedReturnedQty[item.productId] = prev.add(new Decimal(item.quantity));
      }
      const fullyReturned = order.items.every((oi) => {
        const origQty = new Decimal(oi.quantity.toString());
        const returned = updatedReturnedQty[oi.productId] ?? new Decimal(0);
        return origQty.lte(returned);
      });
      if (fullyReturned) {
        await tx.purchaseOrder.update({
          where: { id },
          data: { status: "RETURNED" },
        });
      }

      return { purchaseReturn: ret };
    });

    return NextResponse.json(purchaseReturn, { status: 201 });
  } catch (err: unknown) {
    console.error(`POST /api/purchase-orders/${id}/return failed:`, err);
    return NextResponse.json(
      { error: "Không thể tạo phiếu trả hàng" },
      { status: 500 }
    );
  }
}
