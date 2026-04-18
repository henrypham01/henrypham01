"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  belowMin: boolean;
};

export default function InventoryReportPage() {
  const t = useTranslations();
  const [data, setData] = useState<InventoryRow[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/reports?type=inventory");
    setData(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const belowMinCount = data.filter((r) => r.belowMin).length;

  const columns: ColumnDef<InventoryRow>[] = [
    { accessorKey: "sku", header: t("products.sku") },
    { accessorKey: "name", header: t("products.name") },
    { accessorKey: "category", header: t("products.category") },
    { accessorKey: "unit", header: t("products.unit") },
    {
      accessorKey: "currentStock",
      header: t("products.currentStock"),
      cell: ({ row }) => (
        <span className={row.original.belowMin ? "text-destructive font-bold" : "">
          {row.original.currentStock}
        </span>
      ),
    },
    { accessorKey: "minStock", header: t("products.minStock") },
    { accessorKey: "maxStock", header: t("products.maxStock") },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) =>
        row.original.belowMin ? (
          <Badge variant="destructive">Low</Badge>
        ) : (
          <Badge variant="default">OK</Badge>
        ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("reports.inventory")}</h1>

      {belowMinCount > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 mb-6">
          <p className="font-medium text-destructive">
            {belowMinCount} products below minimum stock level
          </p>
        </div>
      )}

      <DataTable columns={columns} data={data} />
    </div>
  );
}
