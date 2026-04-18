import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notes = await prisma.deliveryNote.findMany({
    include: { invoice: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}
