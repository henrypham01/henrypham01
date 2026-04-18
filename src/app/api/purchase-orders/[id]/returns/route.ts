import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const returns = await prisma.purchaseReturn.findMany({
    where: { purchaseOrderId: id },
    include: {
      items: { include: { product: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(returns);
}
