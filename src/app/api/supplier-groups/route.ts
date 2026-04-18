import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(255),
});

export async function GET() {
  const groups = await prisma.supplierGroup.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  try {
    const group = await prisma.supplierGroup.create({ data: parsed.data });
    return NextResponse.json(group, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Tên nhóm đã tồn tại" },
        { status: 400 }
      );
    }
    throw err;
  }
}
