import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const brandSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(brands);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const brand = await prisma.brand.create({ data: parsed.data });
  return NextResponse.json(brand, { status: 201 });
}
