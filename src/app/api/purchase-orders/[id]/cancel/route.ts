import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  if (order.status !== "DRAFT" && order.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Chỉ phiếu Phác thảo hoặc Hoàn thành mới được huỷ" },
      { status: 400 }
    );
  }

  // If COMPLETED, reverse stock
  if (order.status === "COMPLETED") {
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { currentStock: true, costPrice: true },
      });
      if (!product) continue;

      const newStock = Number(product.currentStock) - Number(item.quantity);

      await prisma.product.update({
        where: { id: item.productId },
        data: { currentStock: Math.max(0, newStock) },
      });

      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          purchaseOrderId: order.id,
          movementType: "STOCK_OUT",
          quantity: Number(item.quantity),
          unitCost: Number(item.costPrice),
          totalCost: Number(item.quantity) * Number(item.costPrice),
          balanceQty: Math.max(0, newStock),
          balanceCost: Number(product.costPrice),
          notes: `Huỷ phiếu nhập ${order.code}`,
        },
      });
    }
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json(updated);
}
