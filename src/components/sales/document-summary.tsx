"use client";

import { useTranslations } from "next-intl";
import { formatVND, amountInWords } from "@/lib/formatting";
import type { LineItemData } from "./line-items-editor";

interface DocumentSummaryProps {
  items: LineItemData[];
  discountAmount?: number;
}

export function calcDocumentTotals(items: LineItemData[], discountAmount = 0) {
  const subtotal = items.reduce((sum, item) => {
    const base = item.quantity * item.unitPrice;
    const disc = base * (item.discountPercent / 100);
    return sum + (base - disc);
  }, 0);

  const vatAmount = items.reduce((sum, item) => {
    const base = item.quantity * item.unitPrice;
    const disc = base * (item.discountPercent / 100);
    return sum + (base - disc) * item.vatRate;
  }, 0);

  const totalAmount = subtotal - discountAmount + vatAmount;

  return { subtotal, vatAmount, totalAmount };
}

export function DocumentSummary({ items, discountAmount = 0 }: DocumentSummaryProps) {
  const t = useTranslations("lineItems");
  const { subtotal, vatAmount, totalAmount } = calcDocumentTotals(items, discountAmount);

  return (
    <div className="mt-4 space-y-1 text-sm max-w-xs ml-auto">
      <div className="flex justify-between">
        <span>{t("subtotal")}:</span>
        <span>{formatVND(subtotal)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="flex justify-between">
          <span>{t("discountAmount")}:</span>
          <span>-{formatVND(discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>{t("vatAmount")}:</span>
        <span>{formatVND(vatAmount)}</span>
      </div>
      <div className="flex justify-between font-bold text-base border-t pt-1">
        <span>{t("totalAmount")}:</span>
        <span>{formatVND(totalAmount)}</span>
      </div>
      <div className="text-xs text-muted-foreground italic pt-1">
        {amountInWords(totalAmount)}
      </div>
    </div>
  );
}
