import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.product.findMany({
    where: { isDeleted: false, usageFunction: { not: null } },
    distinct: ["usageFunction"],
    select: { usageFunction: true },
    orderBy: { usageFunction: "asc" },
  });
  return NextResponse.json(
    rows.map((r) => r.usageFunction).filter((v): v is string => !!v)
  );
}
