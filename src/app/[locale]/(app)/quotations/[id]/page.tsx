"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineItemsEditor, type LineItemData } from "@/components/sales/line-items-editor";
import { DocumentSummary } from "@/components/sales/document-summary";
import { format } from "date-fns";
import { toast } from "sonner";

export default function QuotationDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { locale, id } = params;
  const [quotation, setQuotation] = useState<Record<string, unknown> | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/quotations/${id}`);
    if (res.ok) setQuotation(await res.json());
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!quotation) return <div>{t("common.loading")}</div>;

  const customer = quotation.customer as { name: string };
  const lineItems = (quotation.lineItems as Array<Record<string, unknown>>).map((li) => ({
    productId: li.productId as string,
    productName: (li.product as { name: string })?.name,
    quantity: parseFloat(li.quantity as string),
    unitPrice: parseFloat(li.unitPrice as string),
    discountPercent: parseFloat(li.discountPercent as string),
    vatRate: parseFloat(li.vatRate as string),
    lineTotal: parseFloat(li.lineTotal as string),
  }));

  const handleConfirm = async () => {
    await fetch(`/api/quotations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    toast.success(t("common.success"));
    fetchData();
  };

  const handleConvert = async () => {
    const res = await fetch(`/api/quotations/${id}/convert`, { method: "POST" });
    if (res.ok) {
      toast.success(t("quotations.convertToOrder") + " - " + t("common.success"));
      router.push(`/${locale}/sales-orders`);
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{quotation.documentNumber as string}</h1>
          <Badge className="mt-1">
            {t(`quotations.status.${quotation.status}`)}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            {t("common.back")}
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-muted bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Lưu trữ — chỉ xem. Luồng bán hàng mới sử dụng Hoá đơn trực tiếp.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("quotations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground">{t("quotations.customer")}:</span>
              <p className="font-medium">{customer.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t("quotations.issueDate")}:</span>
              <p>{format(new Date(quotation.issueDate as string), "dd/MM/yyyy")}</p>
            </div>
            {typeof quotation.validUntil === "string" && quotation.validUntil && (
              <div>
                <span className="text-muted-foreground">{t("quotations.validUntil")}:</span>
                <p>{format(new Date(quotation.validUntil), "dd/MM/yyyy")}</p>
              </div>
            )}
          </div>

          <LineItemsEditor items={lineItems} onChange={() => {}} readOnly />
          <DocumentSummary
            items={lineItems}
            discountAmount={parseFloat(quotation.discountAmount as string)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
