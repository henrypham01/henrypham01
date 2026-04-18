import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const supplierSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1).max(255),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  ward: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
});

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { group: true },
  });
  return NextResponse.json(suppliers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Auto-generate code if not provided
  let code = parsed.data.code?.trim() || null;
  if (!code) {
    const last = await prisma.supplier.findFirst({
      where: { code: { startsWith: "NCC" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    let nextNum = 1;
    if (last?.code) {
      const numPart = last.code.replace(/^NCC/, "");
      const parsedNum = parseInt(numPart, 10);
      if (!isNaN(parsedNum)) nextNum = parsedNum + 1;
    }
    code = `NCC${String(nextNum).padStart(6, "0")}`;
  }

  try {
    const supplier = await prisma.supplier.create({
      data: { ...parsed.data, code },
      include: { group: true },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Mã nhà cung cấp đã tồn tại" },
        { status: 400 }
      );
    }
    throw err;
  }
}
