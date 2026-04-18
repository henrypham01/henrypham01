import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators/category";

export async function GET() {
  const categories = await prisma.category.findMany({
    include: {
      parent: true,
      _count: { select: { products: true, children: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = categorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.category.findUnique({
    where: { code: parsed.data.code },
  });

  if (existing) {
    return NextResponse.json(
      { error: { code: ["Code already exists"] } },
      { status: 400 }
    );
  }

  const category = await prisma.category.create({
    data: parsed.data,
  });

  return NextResponse.json(category, { status: 201 });
}
