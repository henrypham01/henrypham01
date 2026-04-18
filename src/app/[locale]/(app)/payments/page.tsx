"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Archive } from "lucide-react";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";

type Payment = {
  id: string;
  documentNumber: string;
  amount: string;
  method: string;
  paymentDate: string;
  customer: { name: string };
  invoice: { documentNumber: string };
};

export default function PaymentsPage() {
  const t = useTranslations();
  const [payments, setPayments] = useState<Payment[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/payments");
    setPayments(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnDef<Payment>[] = [
    { accessorKey: "documentNumber", header: t("payments.documentNumber") },
    {
      id: "invoice",
      header: t("invoices.documentNumber"),
      cell: ({ row }) => row.original.invoice.documentNumber,
    },
    {
      id: "customer",
      header: t("quotations.customer"),
      cell: ({ row }) => row.original.customer.name,
    },
    {
      id: "amount",
      header: t("payments.amount"),
      cell: ({ row }) => formatVND(row.original.amount),
    },
    {
      id: "method",
      header: t("payments.method"),
      cell: ({ row }) => t(`payments.methods.${row.original.method}`),
    },
    {
      id: "paymentDate",
      header: t("payments.paymentDate"),
      cell: ({ row }) =>
        format(new Date(row.original.paymentDate), "dd/MM/yyyy HH:mm"),
    },
  ];

  return (
    <div>
      <PageHeader title={t("payments.title")} />
      <div className="mb-4 rounded-md border border-muted bg-muted/30 px-4 py-3 flex items-center gap-3 text-sm">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Lịch sử thu — chỉ xem. Luồng bán hàng mới thanh toán ngay khi tạo hoá đơn (POS 100%).
        </span>
      </div>
      <DataTable columns={columns} data={payments} />
    </div>
  );
}
