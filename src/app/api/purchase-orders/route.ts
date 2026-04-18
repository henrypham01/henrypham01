import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { Decimal } from "decimal.js";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().gt(0),
  costPrice: z.coerce.number().min(0),
});

const createSchema = z.object({
  code: z.string().optional(),
  supplierId: z.string().optional().nullable(),
  discountAmount: z.coerce.number().min(0).default(0),
  totalPaid: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "Cần ít nhất 1 mặt hàng"),
});

async function generateNextCode(
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  const last = await db.purchaseOrder.findFirst({
    where: { code: { startsWith: "PN" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const num = parseInt(last.code.replace(/^PN/, ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `PN${String(next).padStart(6, "0")}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const supplierId = searchParams.get("supplierId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: true,
      items: { include: { product: true } },
      createdBy: { select: { id: true, fullName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const session = await getSession();
  const { code, supplierId, discountAmount, totalPaid, notes, items } = parsed.data;

  // Money math in Decimal to avoid floating-point drift.
  const discountDec = new Decimal(discountAmount);
  const subtotalDec = items.reduce(
    (s, i) => s.add(new Decimal(i.quantity).mul(new Decimal(i.costPrice))),
    new Decimal(0)
  );
  const totalAmountDec = Decimal.max(0, subtotalDec.sub(discountDec));

  const order = await prisma.$transaction(async (tx) => {
    const finalCode = code || (await generateNextCode(tx));
    return tx.purchaseOrder.create({
      data: {
        code: finalCode,
        notes: notes || null,
        subtotal: subtotalDec.toNumber(),
        discountAmount: discountDec.toNumber(),
        totalAmount: totalAmountDec.toNumber(),
        totalPaid,
        ...(supplierId && { supplier: { connect: { id: supplierId } } }),
        ...(session?.userId && { createdBy: { connect: { id: session.userId } } }),
        items: {
          create: items.map((it, idx) => ({
            productId: it.productId,
            quantity: it.quantity,
            costPrice: it.costPrice,
            lineTotal: new Decimal(it.quantity)
              .mul(new Decimal(it.costPrice))
              .toNumber(),
            sortOrder: idx,
          })),
        },
      },
      include: { items: true, supplier: true },
    });
  });

  return NextResponse.json(order, { status: 201 });
}
