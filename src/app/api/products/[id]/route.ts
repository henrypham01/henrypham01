import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validators/product";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, baseUnit: true, supplier: true, brand: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (!parsed.data.sku) {
    return NextResponse.json(
      { error: { sku: ["Mã hàng là bắt buộc"] } },
      { status: 400 }
    );
  }

  const existing = await prisma.product.findFirst({
    where: { sku: parsed.data.sku, NOT: { id } },
  });

  if (existing) {
    return NextResponse.json(
      { error: { sku: ["Mã hàng đã tồn tại"] } },
      { status: 400 }
    );
  }

  // initialStock/initialCost are create-only meta — ignore on PUT so stock
  // changes can only happen via nhập/xuất.
  const {
    categoryId,
    baseUnitId,
    supplierId,
    brandId,
    initialStock: _initialStock,
    initialCost: _initialCost,
    ...rest
  } = parsed.data;
  void _initialStock;
  void _initialCost;
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      baseUnit: { connect: { id: baseUnitId } },
      category: categoryId
        ? { connect: { id: categoryId } }
        : { disconnect: true },
      supplier: supplierId
        ? { connect: { id: supplierId } }
        : { disconnect: true },
      brand: brandId
        ? { connect: { id: brandId } }
        : { disconnect: true },
    },
  });

  return NextResponse.json(product);
}

// Soft delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
}
