import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { isStarred: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.product.update({
    where: { id },
    data: { isStarred: !product.isStarred },
    select: { id: true, isStarred: true },
  });
  return NextResponse.json(updated);
}
