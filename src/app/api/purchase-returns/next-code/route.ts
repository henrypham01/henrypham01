import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const last = await prisma.purchaseReturn.findFirst({
    where: { code: { startsWith: "PT" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let next = 1;
  if (last?.code) {
    const num = parseInt(last.code.replace(/^PT/, ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return NextResponse.json({ code: `PT${String(next).padStart(6, "0")}` });
}
