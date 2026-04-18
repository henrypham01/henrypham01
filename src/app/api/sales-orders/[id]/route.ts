import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      lineItems: { include: { product: true }, orderBy: { sortOrder: "asc" } },
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

  if (body.status) {
    const order = await prisma.salesOrder.update({
      where: { id },
      data: { status: body.status },
    });
    return NextResponse.json(order);
  }

  return NextResponse.json({ error: "Not implemented" }, { status: 400 });
}
