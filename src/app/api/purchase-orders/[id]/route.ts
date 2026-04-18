import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().gt(0),
  costPrice: z.coerce.number().min(0),
});

const updateSchema = z.object({
  supplierId: z.string().optional().nullable(),
  discountAmount: z.coerce.number().min(0).default(0),
  totalPaid: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "Cần ít nhất 1 mặt hàng"),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      returns: {
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
      },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(order);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Chỉ sửa được phiếu ở trạng thái Phác thảo" },
      { status: 400 }
    );
  }

  const { supplierId, discountAmount, totalPaid, notes, items } = parsed.data;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.costPrice, 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const [, order] = await prisma.$transaction([
    prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } }),
    prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: supplierId || null,
        notes: notes || null,
        subtotal,
        discountAmount,
        totalAmount,
        totalPaid,
        items: {
          create: items.map((it, idx) => ({
            productId: it.productId,
            quantity: it.quantity,
            costPrice: it.costPrice,
            lineTotal: it.quantity * it.costPrice,
            sortOrder: idx,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
        supplier: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  return NextResponse.json(order);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (order.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Chỉ xoá được phiếu ở trạng thái Phác thảo" },
      { status: 400 }
    );
  }
  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
