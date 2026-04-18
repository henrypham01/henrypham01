"use client";

import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Warehouse, AlertTriangle, Calendar } from "lucide-react";

export default function ReportsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams();

  const reports = [
    {
      title: t("reports.revenue"),
      icon: BarChart3,
      href: `/${locale}/reports/revenue`,
    },
    {
      title: t("reports.profit"),
      icon: TrendingUp,
      href: `/${locale}/reports/profit`,
    },
    {
      title: t("reports.inventory"),
      icon: Warehouse,
      href: `/${locale}/reports/inventory`,
    },
    {
      title: t("reports.expiryAlerts"),
      icon: AlertTriangle,
      href: `/${locale}/reports/expiry`,
    },
    {
      title: t("reports.summary"),
      icon: Calendar,
      href: `/${locale}/reports/summary`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("reports.title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {reports.map((r) => (
          <Card
            key={r.href}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => router.push(r.href)}
          >
            <CardHeader className="flex flex-row items-center gap-3">
              <r.icon className="h-8 w-8 text-primary" />
              <CardTitle className="text-base">{r.title}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
