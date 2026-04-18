"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api-error";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Invoice = {
  id: string;
  documentNumber: string;
  issueDate: string;
  status: "CHO_IN" | "DA_IN" | "CANCELLED";
  totalAmount: string;
  paidAmount: string;
  printedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; code: string };
  _count: { lineItems: number };
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  CHO_IN: { label: "Chờ in", variant: "secondary" },
  DA_IN: { label: "Đã in", variant: "default" },
  CANCELLED: { label: "Đã huỷ", variant: "destructive" },
};

export default function InvoicesPage() {
  const router = useRouter();
  const { locale } = useParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/invoices?${params.toString()}`);
    setInvoices(await res.json());
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectableIds = invoices
    .filter((i) => i.status === "CHO_IN")
    .map((i) => i.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };

  const handleBulkPrint = async () => {
    if (selected.size === 0) return;
    setBulking(true);
    let ok = 0;
    let failed = 0;
    for (const id of selected) {
      const res = await fetch(`/api/invoices/${id}?action=bulk-print`, {
        method: "PUT",
      });
      if (res.ok) ok++;
      else failed++;
    }
    setBulking(false);
    if (ok > 0) toast.success(`Đã chuyển ${ok} hoá đơn sang Đã in`);
    if (failed > 0) toast.error(`${failed} hoá đơn thất bại`);
    setSelected(new Set());
    fetchData();
    // Trigger browser print after status update
    setTimeout(() => window.print(), 300);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">Hoá đơn</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tổng: <span className="font-semibold text-foreground">{invoices.length}</span>
            {" · "}
            Chờ in: <span className="font-semibold text-foreground">{invoices.filter((i) => i.status === "CHO_IN").length}</span>
            {" · "}
            Đã in: <span className="font-semibold text-foreground">{invoices.filter((i) => i.status === "DA_IN").length}</span>
          </p>
        </div>
        <Button
          onClick={() => router.push(`/${locale}/invoices/new`)}
          size="sm"
          className="gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Tạo hoá đơn
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo số HĐ, khách hàng..."
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue>
              {statusFilter === "CHO_IN"
                ? "Chờ in"
                : statusFilter === "DA_IN"
                ? "Đã in"
                : statusFilter === "CANCELLED"
                ? "Đã huỷ"
                : "Tất cả"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="CHO_IN">Chờ in</SelectItem>
            <SelectItem value="DA_IN">Đã in</SelectItem>
            <SelectItem value="CANCELLED">Đã huỷ</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 shadow-sm">
            <span className="text-xs text-muted-foreground">Đã chọn {selected.size}</span>
            <Button
              size="sm"
              onClick={handleBulkPrint}
              disabled={bulking}
              className="h-7 gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              In hàng loạt
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 py-3 px-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-input"
                />
              </th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số HĐ</th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Khách hàng</th>
              <th className="py-3 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số mục</th>
              <th className="py-3 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tổng tiền</th>
              <th className="py-3 px-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trạng thái</th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  Chưa có hoá đơn nào
                </td>
              </tr>
            ) : (
              invoices.map((o, i) => {
                const st = statusConfig[o.status];
                const isSelected = selected.has(o.id);
                const canSelect = o.status === "CHO_IN";
                return (
                  <tr
                    key={o.id}
                    className={cn(
                      "border-t cursor-pointer hover:bg-accent/50 transition-colors",
                      i % 2 === 1 && !isSelected && "bg-muted/20",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => router.push(`/${locale}/invoices/${o.id}`)}
                  >
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canSelect}
                        onChange={() => toggleSelect(o.id)}
                        className="h-4 w-4 rounded border-input disabled:opacity-30"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-mono text-xs font-medium">{o.documentNumber}</td>
                    <td className="py-2.5 px-2">{o.customer.name}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{o._count.lineItems}</td>
                    <td className="py-2.5 px-2 text-right font-medium">{formatVND(o.totalAmount)}</td>
                    <td className="py-2.5 px-2 text-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">
                      {format(new Date(o.createdAt), "dd/MM/yyyy HH:mm")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
