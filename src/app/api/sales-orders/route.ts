import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.salesOrder.findMany({
    include: { customer: true, quotation: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}
