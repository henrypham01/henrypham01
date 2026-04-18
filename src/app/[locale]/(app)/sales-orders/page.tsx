"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Archive } from "lucide-react";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";

type SalesOrder = {
  id: string;
  documentNumber: string;
  issueDate: string;
  status: string;
  totalAmount: string;
  customer: { name: string };
};

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  CONVERTED: "outline",
  CANCELLED: "destructive",
};

export default function SalesOrdersPage() {
  const t = useTranslations();
  const [orders, setOrders] = useState<SalesOrder[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/sales-orders");
    setOrders(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnDef<SalesOrder>[] = [
    { accessorKey: "documentNumber", header: t("salesOrders.documentNumber") },
    {
      id: "customer",
      header: t("quotations.customer"),
      cell: ({ row }) => row.original.customer.name,
    },
    {
      id: "issueDate",
      header: t("quotations.issueDate"),
      cell: ({ row }) => format(new Date(row.original.issueDate), "dd/MM/yyyy"),
    },
    {
      id: "totalAmount",
      header: t("common.total"),
      cell: ({ row }) => formatVND(row.original.totalAmount),
    },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={statusColors[row.original.status]}>
          {t(`quotations.status.${row.original.status}`)}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("salesOrders.title")} />

      <div className="mb-4 rounded-md border border-muted bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Lưu trữ — chỉ xem. Luồng bán hàng mới sử dụng Hoá đơn trực tiếp.
        </span>
      </div>

      <DataTable columns={columns} data={orders} />
    </div>
  );
}
