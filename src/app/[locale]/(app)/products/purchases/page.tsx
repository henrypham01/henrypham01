"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type PurchaseOrder = {
  id: string;
  code: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED" | "RETURNED";
  totalAmount: string;
  totalPaid: string;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string } | null;
  _count: { items: number };
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Phác thảo", variant: "secondary" },
  COMPLETED: { label: "Hoàn thành", variant: "default" },
  CANCELLED: { label: "Đã huỷ", variant: "destructive" },
  RETURNED: { label: "Đã trả hàng", variant: "outline" },
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { locale } = useParams();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [completeTarget, setCompleteTarget] = useState<PurchaseOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/purchase-orders");
    setOrders(await res.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmComplete = async () => {
    if (!completeTarget) return;
    const res = await fetch(`/api/purchase-orders/${completeTarget.id}/complete`, { method: "PATCH" });
    if (res.ok) {
      toast.success("Đã xác nhận nhập hàng");
      setCompleteTarget(null);
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Lỗi");
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const res = await fetch(`/api/purchase-orders/${cancelTarget.id}/cancel`, { method: "PATCH" });
    if (res.ok) {
      toast.success("Đã huỷ");
      setCancelTarget(null);
      fetchData();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/purchase-orders/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Đã xoá");
      setDeleteTarget(null);
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Lỗi");
    }
  };

  const totalOrders = orders.length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;
  const totalValue = orders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + parseFloat(o.totalAmount), 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">Nhập hàng</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tổng phiếu: <span className="font-semibold text-foreground">{totalOrders}</span>
            {" · "}
            Hoàn thành: <span className="font-semibold text-foreground">{completedCount}</span>
            {" · "}
            Giá trị nhập: <span className="font-semibold text-foreground">{formatVND(totalValue)}</span>
          </p>
        </div>
        <Button
          onClick={() => router.push(`/${locale}/products/purchases/new`)}
          size="sm"
          className="gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Tạo phiếu nhập
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã phiếu</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">NCC</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tổng tiền</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đã trả</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Còn nợ</th>
              <th className="py-3 px-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trạng thái</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Người tạo</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày tạo</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted-foreground py-10">
                  Chưa có phiếu nhập nào
                </td>
              </tr>
            ) : (
              orders.map((o, i) => {
                const total = parseFloat(o.totalAmount);
                const paid = parseFloat(o.totalPaid);
                const debt = total - paid;
                const st = statusLabels[o.status];
                return (
                  <tr
                    key={o.id}
                    className={cn("border-t cursor-pointer hover:bg-accent/50 transition-colors", i % 2 === 1 && "bg-muted/20")}
                    onClick={() => router.push(`/${locale}/products/purchases/${o.id}`)}
                  >
                    <td className="py-2.5 px-3 font-mono text-xs font-medium">{o.code}</td>
                    <td className="py-2.5 px-3">{o.supplier?.name || "-"}</td>
                    <td className="py-2.5 px-3 text-right">{formatVND(total)}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatVND(paid)}</td>
                    <td className={cn("py-2.5 px-3 text-right", debt > 0 && "text-orange-600 font-medium")}>
                      {formatVND(debt)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {o.createdBy?.fullName || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {format(new Date(o.createdAt), "dd/MM/yyyy HH:mm")}
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {o.status === "DRAFT" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCompleteTarget(o)}
                              title="Xác nhận nhập"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCancelTarget(o)}
                              title="Huỷ"
                            >
                              <X className="h-4 w-4 text-orange-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(o)}
                              title="Xoá"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xác nhận xoá phiếu nhập"
        message="Bạn có chắc chắn muốn xoá phiếu nhập này? Hành động này không thể hoàn tác."
        itemName={deleteTarget?.supplier?.name || undefined}
        itemCode={deleteTarget?.code}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={!!completeTarget}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        title="Xác nhận nhập hàng"
        message="Tồn kho và giá vốn sẽ được cập nhật. Bạn có chắc chắn?"
        itemCode={completeTarget?.code}
        confirmLabel="Xác nhận"
        onConfirm={confirmComplete}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Huỷ phiếu nhập"
        message="Bạn có chắc chắn muốn huỷ phiếu nhập này?"
        itemCode={cancelTarget?.code}
        confirmLabel="Huỷ phiếu"
        onConfirm={confirmCancel}
      />
    </div>
  );
}
