import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unitSchema } from "@/lib/validators/unit";

export async function GET() {
  const units = await prisma.unit.findMany({
    orderBy: { code: "asc" },
  });
  return NextResponse.json(units);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = unitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.unit.findUnique({
    where: { code: parsed.data.code },
  });

  if (existing) {
    return NextResponse.json(
      { error: { code: ["Code already exists"] } },
      { status: 400 }
    );
  }

  const unit = await prisma.unit.create({
    data: parsed.data,
  });

  return NextResponse.json(unit, { status: 201 });
}
