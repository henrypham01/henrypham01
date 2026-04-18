import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

// Confirm purchase order: increase stock, update weighted average cost, record stock movements
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Chỉ phiếu Phác thảo mới được xác nhận" },
      { status: 400 }
    );
  }
  if (order.items.length === 0) {
    return NextResponse.json(
      { error: "Phiếu không có hàng hoá" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Process each item atomically: update stock + weighted average cost,
      // create stock movement. If any step fails, entire PO completion rolls
      // back so stock state stays consistent with order status.
      for (const item of order.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { currentStock: true, costPrice: true },
        });
        if (!product) continue;

        const oldStock = new Decimal(product.currentStock.toString());
        const oldCost = new Decimal(product.costPrice.toString());
        const inQty = new Decimal(item.quantity.toString());
        const inCost = new Decimal(item.costPrice.toString());

        const newStock = oldStock.add(inQty);
        // Weighted average
        const newCost = newStock.gt(0)
          ? oldStock.mul(oldCost).add(inQty.mul(inCost)).div(newStock)
          : inCost;
        const totalCost = inQty.mul(inCost);

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: newStock.toNumber(),
            costPrice: newCost.toNumber(),
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            purchaseOrderId: order.id,
            movementType: "STOCK_IN",
            quantity: inQty.toNumber(),
            unitCost: inCost.toNumber(),
            totalCost: totalCost.toNumber(),
            balanceQty: newStock.toNumber(),
            balanceCost: newStock.mul(newCost).toNumber(),
            notes: `Nhập từ phiếu ${order.code}`,
          },
        });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
        include: { items: { include: { product: true } }, supplier: true },
      });
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error(`PATCH /api/purchase-orders/${id}/complete failed:`, err);
    return NextResponse.json(
      { error: "Không thể hoàn thành phiếu nhập" },
      { status: 500 }
    );
  }
}
