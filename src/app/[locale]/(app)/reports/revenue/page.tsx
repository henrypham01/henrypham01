"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { ReportFilters } from "@/components/reports/report-filters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatVND } from "@/lib/formatting";
import { format, startOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type ProductRevenue = { id: string; name: string; revenue: number; quantity: number };
type RegionRevenue = { region: string; revenue: number };

export default function RevenueReportPage() {
  const t = useTranslations();
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [byProduct, setByProduct] = useState<ProductRevenue[]>([]);
  const [byRegion, setByRegion] = useState<RegionRevenue[]>([]);

  const fetchData = useCallback(async () => {
    const [res1, res2] = await Promise.all([
      fetch(`/api/reports?type=revenue-by-product&from=${from}&to=${to}`),
      fetch(`/api/reports?type=revenue-by-region&from=${from}&to=${to}`),
    ]);
    setByProduct(await res1.json());
    setByRegion(await res2.json());
  }, [from, to]);

  const productColumns: ColumnDef<ProductRevenue>[] = [
    { accessorKey: "name", header: t("products.name") },
    {
      accessorKey: "quantity",
      header: t("lineItems.quantity"),
      cell: ({ row }) => row.original.quantity,
    },
    {
      accessorKey: "revenue",
      header: t("reports.revenue"),
      cell: ({ row }) => formatVND(row.original.revenue),
    },
  ];

  const regionColumns: ColumnDef<RegionRevenue>[] = [
    { accessorKey: "region", header: t("customers.region") },
    {
      accessorKey: "revenue",
      header: t("reports.revenue"),
      cell: ({ row }) => formatVND(row.original.revenue),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("reports.revenue")}</h1>
      <ReportFilters
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onFilter={fetchData}
      />

      <Tabs defaultValue="product">
        <TabsList>
          <TabsTrigger>
          <TabsTrigger>
        </TabsList>

        <TabsContent value="product">
          {byProduct.length > 0 && (
            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byProduct.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v) => formatVND(Number(v))} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <DataTable columns={productColumns} data={byProduct} />
        </TabsContent>

        <TabsContent value="region">
          {byRegion.length > 0 && (
            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byRegion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="region" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v) => formatVND(Number(v))} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <DataTable columns={regionColumns} data={byRegion} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
