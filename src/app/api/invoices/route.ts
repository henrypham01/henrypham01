import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/services/document-number";
import { recordStockOut } from "@/lib/services/cogs.service";
import { Decimal } from "decimal.js";
import { z } from "zod";

const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().gt(0),
  unitPrice: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  vatRate: z.coerce.number().min(0).max(1).default(0.1),
});

const createSchema = z.object({
  customerId: z.string().min(1, "Khách hàng là bắt buộc"),
  discountAmount: z.coerce.number().min(0).default(0),
  shippingFee: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1, "Cần ít nhất 1 mặt hàng"),
  printed: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { documentNumber: { contains: search } },
      { customer: { name: { contains: search } } },
    ];
  }
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to + "T23:59:59.999");
    where.issueDate = range;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: true, _count: { select: { lineItems: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      customerId,
      discountAmount,
      shippingFee,
      notes,
      lineItems,
      printed,
    } = parsed.data;

    // Compute totals using Decimal to avoid floating-point drift.
    const discountAmountDec = new Decimal(discountAmount);
    let subtotal = new Decimal(0);
    let vatAmount = new Decimal(0);
    const items = lineItems.map((li, idx) => {
      const qty = new Decimal(li.quantity);
      const price = new Decimal(li.unitPrice);
      const base = qty.mul(price);
      const disc = base.mul(new Decimal(li.discountPercent).div(100));
      const afterDisc = base.sub(disc);
      const vat = afterDisc.mul(new Decimal(li.vatRate));
      const lineTotal = afterDisc.add(vat);
      subtotal = subtotal.add(afterDisc);
      vatAmount = vatAmount.add(vat);
      return {
        productId: li.productId,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPercent: li.discountPercent,
        vatRate: li.vatRate,
        lineTotal: lineTotal.toNumber(),
        sortOrder: idx,
      };
    });
    const shippingFeeDec = new Decimal(shippingFee);
    const totalAmount = subtotal
      .sub(discountAmountDec)
      .add(vatAmount)
      .add(shippingFeeDec);

    const warnings: string[] = [];

    const invoice = await prisma.$transaction(async (tx) => {
      // Generate number INSIDE the transaction so the MAX() read and the
      // INSERT are atomic on SQLite (BEGIN IMMEDIATE serializes writers).
      const documentNumber = await generateDocumentNumber("invoice", tx);

      const inv = await tx.invoice.create({
        data: {
          documentNumber,
          customerId,
          status: printed ? "DA_IN" : "CHO_IN",
          printedAt: printed ? new Date() : null,
          notes: notes || null,
          subtotal: subtotal.toNumber(),
          discountAmount: discountAmountDec.toNumber(),
          vatAmount: vatAmount.toNumber(),
          shippingFee: shippingFeeDec.toNumber(),
          totalAmount: totalAmount.toNumber(),
          paidAmount: totalAmount.toNumber(), // POS 100% paid
          lineItems: { create: items },
        },
      });

      for (const it of items) {
        const res = await recordStockOut(
          it.productId,
          new Decimal(it.quantity),
          {
            invoiceId: inv.id,
            notes: `Xuất theo hoá đơn ${documentNumber}`,
            tx,
          }
        );
        if (res.warning) warnings.push(`${it.productId}: ${res.warning}`);
      }

      return inv;
    });

    return NextResponse.json({ ...invoice, warnings }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/invoices failed:", err);
    return NextResponse.json(
      { error: "Không thể tạo hoá đơn" },
      { status: 500 }
    );
  }
}
