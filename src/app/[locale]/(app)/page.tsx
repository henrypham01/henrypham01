"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt, CreditCard, Package, AlertTriangle } from "lucide-react";
import { formatVND } from "@/lib/formatting";

type DashboardData = {
  totalRevenue: number;
  outstandingReceivables: number;
  totalProducts: number;
  lowStockCount: number;
};

export default function DashboardPage() {
  const t = useTranslations();
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchData = useCallback(async () => {
    const [invoicesRes, productsRes, inventoryRes] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/products"),
      fetch("/api/reports?type=inventory"),
    ]);

    const invoices = await invoicesRes.json();
    const products = await productsRes.json();
    const inventory = await inventoryRes.json();

    const totalRevenue = invoices
      .filter((i: { status: string }) => ["ISSUED", "PARTIAL_PAID", "PAID"].includes(i.status))
      .reduce((s: number, i: { totalAmount: string }) => s + parseFloat(i.totalAmount), 0);

    const outstandingReceivables = invoices
      .filter((i: { status: string }) => ["ISSUED", "PARTIAL_PAID"].includes(i.status))
      .reduce(
        (s: number, i: { totalAmount: string; paidAmount: string }) =>
          s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount),
        0
      );

    const lowStockCount = inventory.filter((i: { belowMin: boolean }) => i.belowMin).length;

    setData({
      totalRevenue,
      outstandingReceivables,
      totalProducts: products.length,
      lowStockCount,
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cards = [
    {
      title: t("reports.revenue"),
      value: data ? formatVND(data.totalRevenue) : "—",
      icon: Receipt,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      accent: "border-l-blue-500",
    },
    {
      title: t("customers.outstanding"),
      value: data ? formatVND(data.outstandingReceivables) : "—",
      icon: CreditCard,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      accent: "border-l-orange-500",
    },
    {
      title: t("nav.products"),
      value: data ? String(data.totalProducts) : "—",
      icon: Package,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      accent: "border-l-emerald-500",
    },
    {
      title: "Sắp hết hàng",
      value: data ? String(data.lowStockCount) : "—",
      icon: AlertTriangle,
      iconBg: data && data.lowStockCount > 0 ? "bg-red-50" : "bg-gray-50",
      iconColor: data && data.lowStockCount > 0 ? "text-red-500" : "text-muted-foreground",
      accent: data && data.lowStockCount > 0 ? "border-l-red-500" : "border-l-gray-300",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("nav.dashboard")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tổng quan hoạt động kinh doanh</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className={`border-l-4 ${card.accent} shadow-sm`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground leading-none mb-2 truncate">
                    {card.title}
                  </p>
                  <p className="text-xl font-bold tracking-tight truncate">
                    {card.value}
                  </p>
                </div>
                <div className={`h-9 w-9 rounded-lg ${card.iconBg} flex items-center justify-center shrink-0`}>
                  <card.icon className={`h-4.5 w-4.5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
