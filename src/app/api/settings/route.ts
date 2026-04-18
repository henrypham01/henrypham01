import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const ALLOWED_KEYS = [
  "company_name",
  "company_address",
  "company_tax_id",
  "company_phone",
  // Printing — deviceName strings as returned by Electron's webContents
  // .getPrinters().
  "print_k80_printer",
  "print_a6_printer",
  // Default size when the "Thanh toán" button auto-prints (k80 | a6 | none)
  "print_default_size",
  // Footer message on receipts
  "print_footer_message",
] as const;

const updateSchema = z.object(
  Object.fromEntries(
    ALLOWED_KEYS.map((k) => [k, z.string().max(500).optional()])
  ) as Record<(typeof ALLOWED_KEYS)[number], z.ZodOptional<z.ZodString>>
);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const s of settings) {
    obj[s.key] = s.value;
  }
  return NextResponse.json(obj);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const entries = Object.entries(parsed.data).filter(
    ([, value]) => value !== undefined
  ) as [string, string][];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );

  return NextResponse.json({ success: true });
}
