"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  sku: string;
  name: string;
  batchNumber: string | null;
  expiryDate: string | null;
  currentStock: string;
  usageFunction: string | null;
  supplier: { id: string; name: string } | null;
};

export default function ExpiryAlertsPage() {
  const router = useRouter();
  const { locale } = useParams();
  const [days, setDays] = useState("30");
  const [products, setProducts] = useState<Product[]>([]);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/products?expiring=${days}`);
    const data = await res.json();
    // Sort by expiry ascending
    const sorted = [...data].sort((a: Product, b: Product) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    setProducts(sorted);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/reports`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Cảnh báo cận date
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sản phẩm sắp hết hạn hoặc đã hết hạn
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ngưỡng:</span>
          <Select value={days} onValueChange={(v) => v && setDays(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue>
                {days === "30" ? "Trong 30 ngày" :
                 days === "60" ? "Trong 60 ngày" :
                 days === "90" ? "Trong 90 ngày" : days}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Trong 30 ngày</SelectItem>
              <SelectItem value="60">Trong 60 ngày</SelectItem>
              <SelectItem value="90">Trong 90 ngày</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 text-sm">
        <Badge variant="outline" className="gap-1">
          Tổng: {products.length}
        </Badge>
        <Badge variant="destructive" className="gap-1">
          Đã hết hạn:{" "}
          {products.filter((p) =>
            p.expiryDate
              ? differenceInDays(new Date(p.expiryDate), new Date()) < 0
              : false
          ).length}
        </Badge>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">Mã hàng</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tên hàng</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">Số lô</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">HSD</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">Còn lại</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">Tồn kho</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">NCC</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  Không có sản phẩm cận date
                </td>
              </tr>
            ) : (
              products.map((p, i) => {
                const daysLeft = p.expiryDate
                  ? differenceInDays(new Date(p.expiryDate), new Date())
                  : null;
                const expired = daysLeft !== null && daysLeft < 0;
                const near = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t cursor-pointer hover:bg-accent/50 transition-colors",
                      i % 2 === 1 && "bg-muted/20",
                      expired && "bg-destructive/5"
                    )}
                    onClick={() => router.push(`/${locale}/products/${p.id}`)}
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">{p.sku}</td>
                    <td className="py-2.5 px-3 font-medium">{p.name}</td>
                    <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                      {p.batchNumber || "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.expiryDate
                        ? format(new Date(p.expiryDate), "dd/MM/yyyy")
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {daysLeft === null ? (
                        "-"
                      ) : expired ? (
                        <Badge variant="destructive">Đã hết hạn</Badge>
                      ) : (
                        <span className={cn(near && "text-orange-600 font-medium")}>
                          Còn {daysLeft} ngày
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {Number(p.currentStock).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {p.supplier?.name || "-"}
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
