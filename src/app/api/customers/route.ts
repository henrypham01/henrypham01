import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validators/customer";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { code: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = customerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.customer.findUnique({
    where: { code: parsed.data.code },
  });

  if (existing) {
    return NextResponse.json(
      { error: { code: ["Code already exists"] } },
      { status: 400 }
    );
  }

  const data = {
    ...parsed.data,
    email: parsed.data.email || null,
  };

  const customer = await prisma.customer.create({ data });
  return NextResponse.json(customer, { status: 201 });
}
