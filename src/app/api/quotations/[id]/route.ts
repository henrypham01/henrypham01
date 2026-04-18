import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      lineItems: { include: { product: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quotation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(quotation);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (body.status) {
    const quotation = await prisma.quotation.update({
      where: { id },
      data: { status: body.status },
    });
    return NextResponse.json(quotation);
  }

  const { customerId, validUntil, notes, lineItems, discountAmount } = body;

  // Delete old line items and create new ones
  let subtotal = 0;
  let vatAmount = 0;

  const items = lineItems.map((item: Record<string, number>, index: number) => {
    const base = item.quantity * item.unitPrice;
    const disc = base * ((item.discountPercent || 0) / 100);
    const afterDisc = base - disc;
    const vat = afterDisc * (item.vatRate || 0.1);
    const lineTotal = afterDisc + vat;

    subtotal += afterDisc;
    vatAmount += vat;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent || 0,
      vatRate: item.vatRate || 0.1,
      lineTotal,
      sortOrder: index,
    };
  });

  const totalAmount = subtotal - (discountAmount || 0) + vatAmount;

  await prisma.lineItem.deleteMany({ where: { quotationId: id } });

  const quotation = await prisma.quotation.update({
    where: { id },
    data: {
      customerId,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes,
      subtotal,
      discountAmount: discountAmount || 0,
      vatAmount,
      totalAmount,
      lineItems: { create: items },
    },
    include: { customer: true, lineItems: { include: { product: true } } },
  });

  return NextResponse.json(quotation);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.quotation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
