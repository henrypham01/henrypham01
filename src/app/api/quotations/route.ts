import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/services/document-number";
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
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  discountAmount: z.coerce.number().min(0).default(0),
  lineItems: z.array(lineItemSchema).min(1, "Cần ít nhất 1 mặt hàng"),
});

export async function GET() {
  const quotations = await prisma.quotation.findMany({
    include: { customer: true, lineItems: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(quotations);
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

    const { customerId, validUntil, notes, lineItems, discountAmount } = parsed.data;

    const discountAmountDec = new Decimal(discountAmount);
    let subtotal = new Decimal(0);
    let vatAmount = new Decimal(0);

    const items = lineItems.map((item, index) => {
      const qty = new Decimal(item.quantity);
      const price = new Decimal(item.unitPrice);
      const base = qty.mul(price);
      const disc = base.mul(new Decimal(item.discountPercent).div(100));
      const afterDisc = base.sub(disc);
      const vat = afterDisc.mul(new Decimal(item.vatRate));
      const lineTotal = afterDisc.add(vat);
      subtotal = subtotal.add(afterDisc);
      vatAmount = vatAmount.add(vat);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        vatRate: item.vatRate,
        lineTotal: lineTotal.toNumber(),
        sortOrder: index,
      };
    });

    const totalAmount = subtotal.sub(discountAmountDec).add(vatAmount);

    const quotation = await prisma.$transaction(async (tx) => {
      const documentNumber = await generateDocumentNumber("quotation", tx);
      return tx.quotation.create({
        data: {
          documentNumber,
          customerId,
          validUntil: validUntil ? new Date(validUntil) : null,
          notes: notes || null,
          subtotal: subtotal.toNumber(),
          discountAmount: discountAmountDec.toNumber(),
          vatAmount: vatAmount.toNumber(),
          totalAmount: totalAmount.toNumber(),
          lineItems: { create: items },
        },
        include: { customer: true, lineItems: { include: { product: true } } },
      });
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/quotations failed:", err);
    return NextResponse.json(
      { error: "Không thể tạo báo giá" },
      { status: 500 }
    );
  }
}
