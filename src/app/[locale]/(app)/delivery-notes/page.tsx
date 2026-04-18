"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Archive } from "lucide-react";
import { format } from "date-fns";

type DeliveryNote = {
  id: string;
  documentNumber: string;
  issueDate: string;
  status: string;
  invoice: { documentNumber: string; customer: { name: string } };
};

export default function DeliveryNotesPage() {
  const t = useTranslations();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/delivery-notes");
    setNotes(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnDef<DeliveryNote>[] = [
    { accessorKey: "documentNumber", header: t("deliveryNotes.documentNumber") },
    {
      id: "invoice",
      header: t("invoices.documentNumber"),
      cell: ({ row }) => row.original.invoice.documentNumber,
    },
    {
      id: "customer",
      header: t("quotations.customer"),
      cell: ({ row }) => row.original.invoice.customer.name,
    },
    {
      id: "issueDate",
      header: t("common.date"),
      cell: ({ row }) => format(new Date(row.original.issueDate), "dd/MM/yyyy"),
    },
    {
      id: "status",
      header: t("common.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.status === "COMPLETED" ? "default" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("deliveryNotes.title")} />
      <div className="mb-4 rounded-md border border-muted bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Lưu trữ — chỉ xem. Luồng bán hàng mới tự động trừ kho khi tạo hoá đơn.
        </span>
      </div>
      <DataTable columns={columns} data={notes} />
    </div>
  );
}
