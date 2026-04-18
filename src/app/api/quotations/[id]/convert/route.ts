import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/services/document-number";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { lineItems: true },
  });

  if (!quotation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (quotation.status === "CONVERTED") {
    return NextResponse.json(
      { error: "Already converted" },
      { status: 400 }
    );
  }

  const salesOrder = await prisma.$transaction(async (tx) => {
    const documentNumber = await generateDocumentNumber("salesOrder", tx);
    // Create sales order with copied line items
    const so = await tx.salesOrder.create({
      data: {
        documentNumber,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        subtotal: quotation.subtotal,
        discountAmount: quotation.discountAmount,
        vatAmount: quotation.vatAmount,
        totalAmount: quotation.totalAmount,
        notes: quotation.notes,
        lineItems: {
          create: quotation.lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discountPercent: li.discountPercent,
            vatRate: li.vatRate,
            lineTotal: li.lineTotal,
            sortOrder: li.sortOrder,
          })),
        },
      },
    });

    // Mark quotation as converted
    await tx.quotation.update({
      where: { id },
      data: { status: "CONVERTED" },
    });

    return so;
  });

  return NextResponse.json(salesOrder, { status: 201 });
}
