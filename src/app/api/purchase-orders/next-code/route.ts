import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Format: PN + 6 digits
export async function GET() {
  const last = await prisma.purchaseOrder.findFirst({
    where: { code: { startsWith: "PN" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let nextNum = 1;
  if (last?.code) {
    const numPart = last.code.replace(/^PN/, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  const code = `PN${String(nextNum).padStart(6, "0")}`;
  return NextResponse.json({ code });
}
