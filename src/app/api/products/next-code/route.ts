import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Generate next product code in format SP000001 (SP + 6 digits)
export async function GET() {
  const last = await prisma.product.findFirst({
    where: { sku: { startsWith: "SP" } },
    orderBy: { sku: "desc" },
    select: { sku: true },
  });

  let nextNum = 1;
  if (last?.sku) {
    const numPart = last.sku.replace(/^SP/, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  const code = `SP${String(nextNum).padStart(6, "0")}`;
  return NextResponse.json({ code });
}
