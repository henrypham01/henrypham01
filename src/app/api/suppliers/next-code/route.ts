import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Generate next supplier code in format NCC000001 (NCC + 6 digits)
export async function GET() {
  const last = await prisma.supplier.findFirst({
    where: { code: { startsWith: "NCC" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let nextNum = 1;
  if (last?.code) {
    const numPart = last.code.replace(/^NCC/, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  const code = `NCC${String(nextNum).padStart(6, "0")}`;
  return NextResponse.json({ code });
}
