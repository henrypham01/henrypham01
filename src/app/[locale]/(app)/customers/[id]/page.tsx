"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  User,
  Phone,
  Mail,
  FileBadge,
  MapPin,
  Map,
  CalendarClock,
  Wallet,
  Percent,
  Receipt,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Invoice = {
  id: string;
  documentNumber: string;
  issueDate: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
};

type Payment = {
  id: string;
  documentNumber: string;
  paymentDate: string;
  amount: string;
  method: string;
  notes: string | null;
};

type Customer = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  paymentTermDays: number;
  creditLimit: string;
  discountPercent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  invoices: Invoice[];
  payments: Payment[];
};

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-sm font-medium mt-0.5 break-words",
            mono && "font-mono"
          )}
        >
          {value || "-"}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "success" | "warning";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent === "primary" && "bg-primary/5 border-primary/20",
        accent === "success" && "bg-emerald-500/5 border-emerald-500/20",
        accent === "warning" && "bg-orange-500/5 border-orange-500/20",
        !accent && "bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              accent === "primary" && "text-primary",
              accent === "success" && "text-emerald-600",
              accent === "warning" && "text-orange-600",
              !accent && "text-muted-foreground"
            )}
          />
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          accent === "primary" && "text-primary",
          accent === "warning" && "text-orange-600"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function CustomerDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { locale, id } = params;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/customers/${id}`);
    if (res.ok) {
      setCustomer(await res.json());
    } else {
      router.replace(`/${locale}/customers`);
    }
  }, [id, locale, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!customer) return;
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("common.success"));
      router.replace(`/${locale}/customers`);
    } else {
      toast.error(t("common.error"));
    }
  };

  if (!customer) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  // Aggregates
  const totalInvoiceAmount = customer.invoices.reduce(
    (s, i) => s + parseFloat(i.totalAmount || "0"),
    0
  );
  const totalPaidFromInvoices = customer.invoices.reduce(
    (s, i) => s + parseFloat(i.paidAmount || "0"),
    0
  );
  const totalPayments = customer.payments.reduce(
    (s, p) => s + parseFloat(p.amount || "0"),
    0
  );
  // Outstanding = hoá đơn đã xuất − đã thu (tính từ payments record nếu có,
  // fallback vào paidAmount trên invoice).
  const collected = Math.max(totalPaidFromInvoices, totalPayments);
  const outstanding = Math.max(0, totalInvoiceAmount - collected);
  const creditLimitNum = parseFloat(customer.creditLimit || "0");
  const creditUsagePct =
    creditLimitNum > 0 ? (outstanding / creditLimitNum) * 100 : 0;

  const address = [customer.address, customer.city, customer.region]
    .filter(Boolean)
    .join(", ");

  const initials = customer.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/customers`)}
            className="mt-0.5"
            aria-label="Quay lại"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {initials || <User className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {customer.code}
                </span>
                {customer.taxId && (
                  <Badge variant="outline" className="text-[10px]">
                    MST: {customer.taxId}
                  </Badge>
                )}
                {customer.region && (
                  <Badge variant="secondary" className="text-[10px]">
                    {customer.region}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${locale}/customers`)}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/${locale}/customers?edit=${customer.id}`)
            }
            className="gap-1.5"
          >
            <Pencil className="h-4 w-4" />
            {t("common.edit")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {t("common.delete")}
          </Button>
        </div>
      </div>

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tổng hoá đơn"
          value={formatVND(totalInvoiceAmount)}
          sub={`${customer.invoices.length} hoá đơn`}
          icon={Receipt}
          accent="primary"
        />
        <StatCard
          label="Đã thu"
          value={formatVND(collected)}
          sub={
            totalInvoiceAmount > 0
              ? `${Math.round((collected / totalInvoiceAmount) * 100)}%`
              : undefined
          }
          icon={Banknote}
          accent="success"
        />
        <StatCard
          label="Công nợ"
          value={formatVND(outstanding)}
          sub={outstanding > 0 ? "Còn phải thu" : "Không có công nợ"}
          icon={Wallet}
          accent={outstanding > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Hạn mức tín dụng"
          value={formatVND(creditLimitNum)}
          sub={
            creditLimitNum > 0
              ? `Đã dùng ${creditUsagePct.toFixed(0)}%`
              : "Chưa thiết lập"
          }
          icon={Percent}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: contact + address + terms */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Thông tin liên hệ</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow
                icon={User}
                label="Người liên hệ"
                value={customer.contactPerson}
              />
              <Separator />
              <InfoRow icon={Phone} label="Điện thoại" value={customer.phone} />
              <Separator />
              <InfoRow icon={Mail} label="Email" value={customer.email} />
              <Separator />
              <InfoRow
                icon={FileBadge}
                label="Mã số thuế"
                value={customer.taxId}
                mono
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Địa chỉ</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow
                icon={MapPin}
                label="Địa chỉ"
                value={customer.address}
              />
              <Separator />
              <InfoRow icon={Map} label="Tỉnh/Thành phố" value={customer.city} />
              <Separator />
              <InfoRow icon={Map} label="Khu vực" value={customer.region} />
              {address && (
                <>
                  <Separator />
                  <InfoRow
                    label="Địa chỉ đầy đủ"
                    value={
                      <span className="italic text-muted-foreground">
                        {address}
                      </span>
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Điều khoản</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow
                icon={CalendarClock}
                label="Hạn thanh toán"
                value={`${customer.paymentTermDays} ngày`}
              />
              <Separator />
              <InfoRow
                icon={Wallet}
                label="Hạn mức tín dụng"
                value={formatVND(customer.creditLimit)}
              />
              <Separator />
              <InfoRow
                icon={Percent}
                label="Giảm giá mặc định"
                value={`${customer.discountPercent}%`}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column: recent invoices + payments */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Hoá đơn gần đây</CardTitle>
              <span className="text-xs text-muted-foreground">
                {customer.invoices.length} gần nhất
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              {customer.invoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có hoá đơn nào
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 text-left font-medium">
                          Số HĐ
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">
                          Ngày
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">
                          Trạng thái
                        </th>
                        <th className="py-2 pr-3 text-right font-medium">
                          Tổng tiền
                        </th>
                        <th className="py-2 text-right font-medium">Đã trả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.invoices.map((inv) => {
                        const total = parseFloat(inv.totalAmount || "0");
                        const paid = parseFloat(inv.paidAmount || "0");
                        const diff = total - paid;
                        return (
                          <tr
                            key={inv.id}
                            className="border-b last:border-b-0 hover:bg-accent/40 cursor-pointer"
                            onClick={() =>
                              router.push(`/${locale}/invoices/${inv.id}`)
                            }
                          >
                            <td className="py-2 pr-3 font-mono text-xs">
                              {inv.documentNumber}
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">
                              {format(new Date(inv.issueDate), "dd/MM/yyyy")}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge
                                variant={
                                  inv.status === "CANCELLED"
                                    ? "destructive"
                                    : inv.status === "DA_IN"
                                    ? "secondary"
                                    : "default"
                                }
                                className="text-[10px]"
                              >
                                {inv.status === "CHO_IN"
                                  ? "Chờ in"
                                  : inv.status === "DA_IN"
                                  ? "Đã in"
                                  : "Đã huỷ"}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-right font-medium tabular-nums">
                              {formatVND(total)}
                            </td>
                            <td
                              className={cn(
                                "py-2 text-right tabular-nums",
                                diff > 0 && "text-orange-600 font-medium"
                              )}
                            >
                              {formatVND(paid)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Lịch sử thanh toán</CardTitle>
              <span className="text-xs text-muted-foreground">
                {customer.payments.length} gần nhất
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              {customer.payments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có phiếu thu nào
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 text-left font-medium">
                          Số phiếu
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">
                          Ngày
                        </th>
                        <th className="py-2 pr-3 text-left font-medium">
                          Phương thức
                        </th>
                        <th className="py-2 text-right font-medium">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-mono text-xs">
                            {p.documentNumber}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">
                            {format(new Date(p.paymentDate), "dd/MM/yyyy")}
                          </td>
                          <td className="py-2 pr-3 text-xs">{p.method}</td>
                          <td className="py-2 text-right font-medium tabular-nums">
                            {formatVND(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-x-8 text-sm">
                <div className="flex justify-between border-b py-2">
                  <span className="text-muted-foreground">Mã KH</span>
                  <span className="font-mono font-medium">{customer.code}</span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="text-muted-foreground">Ngày tạo</span>
                  <span>
                    {format(new Date(customer.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
                <div className="flex justify-between border-b py-2">
                  <span className="text-muted-foreground">Cập nhật</span>
                  <span>
                    {format(new Date(customer.updatedAt), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("common.deleteConfirmTitle")}
        message={t("common.deleteConfirmMessage")}
        itemName={customer.name}
        itemCode={customer.code}
        onConfirm={handleDelete}
      />
    </div>
  );
}
