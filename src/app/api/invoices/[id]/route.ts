import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordStockOut, recordStockReversal } from "@/lib/services/cogs.service";
import { Decimal } from "decimal.js";
import { z } from "zod";

const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().gt(0),
  unitPrice: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  vatRate: z.coerce.number().min(0).max(1).default(0.1),
});

const editSchema = z.object({
  customerId: z.string().min(1),
  discountAmount: z.coerce.number().min(0).default(0),
  shippingFee: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lineItems: {
        include: { product: true },
        orderBy: { sortOrder: "asc" },
      },
      payments: true,
      stockMovements: true,
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(invoice);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "edit";

    const current = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ==== EDIT (re-save line items, reconcile stock) ====
    if (action === "edit") {
      if (current.status !== "CHO_IN") {
        return NextResponse.json(
          { error: "Chỉ sửa được hoá đơn ở trạng thái Chờ in" },
          { status: 400 }
        );
      }
      const body = await request.json().catch(() => null);
      if (!body) {
        return NextResponse.json(
          { error: "Dữ liệu không hợp lệ" },
          { status: 400 }
        );
      }
      const parsed = editSchema.safeParse(body);
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
      } = parsed.data;

      // Compute new totals
      let subtotal = 0;
      let vatAmount = 0;
      const newItems = lineItems.map((li, idx) => {
        const base = li.quantity * li.unitPrice;
        const disc = base * (li.discountPercent / 100);
        const afterDisc = base - disc;
        const vat = afterDisc * li.vatRate;
        const lineTotal = afterDisc + vat;
        subtotal += afterDisc;
        vatAmount += vat;
        return {
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountPercent: li.discountPercent,
          vatRate: li.vatRate,
          lineTotal,
          sortOrder: idx,
        };
      });
      const totalAmount = subtotal - discountAmount + vatAmount + shippingFee;

      const warnings: string[] = [];

      const updated = await prisma.$transaction(async (tx) => {
        // 1. Reverse old line item stock-outs
        for (const oldLi of current.lineItems) {
          await recordStockReversal(oldLi.productId, new Decimal(oldLi.quantity.toString()), {
            invoiceId: id,
            notes: `Hoàn kho để sửa hoá đơn ${current.documentNumber}`,
            tx,
          });
        }
        // 2. Delete old line items
        await tx.lineItem.deleteMany({ where: { invoiceId: id } });
        // 3. Update invoice + create new line items
        const inv = await tx.invoice.update({
          where: { id },
          data: {
            customerId,
            discountAmount,
            shippingFee,
            notes: notes || null,
            subtotal,
            vatAmount,
            totalAmount,
            paidAmount: totalAmount,
            lineItems: { create: newItems },
          },
        });
        // 4. Apply new stock-outs
        for (const it of newItems) {
          const res = await recordStockOut(it.productId, new Decimal(it.quantity), {
            invoiceId: id,
            notes: `Xuất theo hoá đơn ${current.documentNumber} (sửa)`,
            tx,
          });
          if (res.warning) warnings.push(`${it.productId}: ${res.warning}`);
        }
        return inv;
      });

      return NextResponse.json({ ...updated, warnings });
    }

    // ==== PRINT / BULK_PRINT (CHO_IN → DA_IN, no stock change) ====
    if (action === "print" || action === "bulk-print") {
      if (current.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Không thể in hoá đơn đã huỷ" },
          { status: 400 }
        );
      }
      if (current.status === "DA_IN") {
        // Already printed → reprint is no-op in DB
        return NextResponse.json(current);
      }
      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: "DA_IN", printedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    // ==== CANCEL (restore stock) ====
    if (action === "cancel") {
      if (current.status === "CANCELLED") {
        return NextResponse.json(current); // no-op
      }
      const updated = await prisma.$transaction(async (tx) => {
        for (const li of current.lineItems) {
          await recordStockReversal(li.productId, new Decimal(li.quantity.toString()), {
            invoiceId: id,
            notes: `Huỷ hoá đơn ${current.documentNumber}`,
            tx,
          });
        }
        return tx.invoice.update({
          where: { id },
          data: { status: "CANCELLED", paidAmount: 0 },
        });
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi máy chủ";
    console.error("PUT /api/invoices/[id] failed:", err);
    return NextResponse.json(
      { error: `Không thể cập nhật hoá đơn: ${msg}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const current = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (current.status === "CANCELLED") {
      return NextResponse.json({ success: true });
    }
    await prisma.$transaction(async (tx) => {
      for (const li of current.lineItems) {
        await recordStockReversal(li.productId, new Decimal(li.quantity.toString()), {
          invoiceId: id,
          notes: `Xoá hoá đơn ${current.documentNumber}`,
          tx,
        });
      }
      await tx.invoice.update({
        where: { id },
        data: { status: "CANCELLED", paidAmount: 0 },
      });
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi máy chủ";
    console.error("DELETE /api/invoices/[id] failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
