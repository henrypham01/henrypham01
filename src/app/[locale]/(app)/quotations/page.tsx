"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Archive } from "lucide-react";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";

type Quotation = {
  id: string;
  documentNumber: string;
  issueDate: string;
  validUntil: string | null;
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

export default function QuotationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams();
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/quotations");
    setQuotations(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnDef<Quotation>[] = [
    { accessorKey: "documentNumber", header: t("quotations.documentNumber") },
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
    {
      id: "actions",
      header: t("common.actions"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/quotations/${row.original.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("quotations.title")} />

      <div className="mb-4 rounded-md border border-muted bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Lưu trữ — chỉ xem. Luồng bán hàng mới sử dụng Hoá đơn trực tiếp.
        </span>
      </div>

      <DataTable columns={columns} data={quotations} />
    </div>
  );
}
