"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { ReportFilters } from "@/components/reports/report-filters";
import { formatVND } from "@/lib/formatting";
import { format, startOfMonth } from "date-fns";

type ProfitRow = {
  id: string;
  name: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
};

export default function ProfitReportPage() {
  const t = useTranslations();
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<ProfitRow[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/reports?type=profit&from=${from}&to=${to}`);
    setData(await res.json());
  }, [from, to]);

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = data.reduce((s, r) => s + r.cogs, 0);
  const totalProfit = totalRevenue - totalCogs;

  const columns: ColumnDef<ProfitRow>[] = [
    { accessorKey: "name", header: t("products.name") },
    {
      accessorKey: "revenue",
      header: t("reports.revenue"),
      cell: ({ row }) => formatVND(row.original.revenue),
    },
    {
      id: "cogs",
      header: "COGS",
      cell: ({ row }) => formatVND(row.original.cogs),
    },
    {
      accessorKey: "grossProfit",
      header: t("reports.grossProfit"),
      cell: ({ row }) => (
        <span className={row.original.grossProfit < 0 ? "text-green-600"}>
          {formatVND(row.original.grossProfit)}
        </span>
      ),
    },
    {
      id: "margin",
      header: "Margin (%)",
      cell: ({ row }) => `${row.original.margin.toFixed(1)}%`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("reports.profit")}</h1>
      <ReportFilters
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onFilter={fetchData}
      />

      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border p-4">
            </p>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            </p>
            </p>
          </div>
          <div className="rounded-lg border p-4">
            </p>
            <p className={`text-green-600"}`}>
              {formatVND(totalProfit)}
            </p>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={data} />
    </div>
  );
}
