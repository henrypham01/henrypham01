"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ImageIcon,
  Star,
  Package,
  Tag,
  Ruler,
  Factory,
  Award,
  MapPin,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Hash,
  CalendarDays,
  AlertTriangle,
  FileBadge,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatVND } from "@/lib/formatting";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  nameEn: string | null;
  description: string | null;
  categoryId: string | null;
  baseUnitId: string;
  supplierId: string | null;
  brandId: string | null;
  costPrice: string;
  sellingPrice: string;
  vatRate: string;
  minStock: string;
  maxStock: string;
  currentStock: string;
  origin: string | null;
  imageUrl: string | null;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  registrationNumber: string | null;
  usageFunction: string | null;
  category: { id: string; name: string } | null;
  baseUnit: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
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
        <p className={cn("text-sm font-medium mt-0.5", mono && "font-mono")}>
          {value || "-"}
        </p>
      </div>
    </div>
  );
}

function PriceCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "muted" | "destructive";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent === "primary" && "bg-primary/5 border-primary/20",
        accent === "destructive" && "bg-destructive/5 border-destructive/20",
        !accent || accent === "muted" ? "bg-muted/30" : ""
      )}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className={cn(
          "text-lg font-bold",
          accent === "primary" && "text-primary",
          accent === "destructive" && "text-destructive"
        )}
      >
        {formatVND(value)}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function ProductDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { locale, id } = params;
  const [product, setProduct] = useState<Product | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/products/${id}`);
    if (res.ok) {
      setProduct(await res.json());
    } else {
      router.replace(`/${locale}/products`);
    }
  }, [id, locale, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!product) return;
    const res = await fetch(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("common.success"));
      router.replace(`/${locale}/products`);
    } else {
      toast.error(t("common.error"));
    }
  };

  const handleStar = async () => {
    if (!product) return;
    setProduct({ ...product, isStarred: !product.isStarred });
    const res = await fetch(`/api/products/${product.id}/star`, {
      method: "PATCH",
    });
    if (!res.ok) {
      setProduct({ ...product, isStarred: product.isStarred });
    }
  };

  if (!product) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const stock = parseFloat(product.currentStock);
  const min = parseFloat(product.minStock);
  const max = parseFloat(product.maxStock);
  const cost = parseFloat(product.costPrice);
  const sell = parseFloat(product.sellingPrice);
  const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
  const vatPercent = (parseFloat(product.vatRate) * 100).toFixed(0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/products`)}
            className="mt-0.5"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{product.name}</h1>
              <button type="button" onClick={handleStar} className="p-1">
                <Star
                  className={cn(
                    "h-5 w-5",
                    product.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  )}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm text-muted-foreground">
                {product.sku}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${locale}/products`)}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate back and trigger edit dialog
              router.push(`/${locale}/products?edit=${product.id}`);
            }}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Image + basic info */}
        <div className="space-y-6">
          {/* Image */}
          <Card>
            <CardContent className="p-4">
              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                ) : (
                  <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Classification */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Phân loại</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InfoRow
                icon={Tag}
                label="Nhóm hàng"
                value={product.category?.name}
              />
              <Separator />
              <InfoRow
                icon={Ruler}
                label="Đơn vị tính"
                value={product.baseUnit.name}
              />
              <Separator />
              <InfoRow
                icon={Factory}
                label="Nhà cung cấp"
                value={product.supplier?.name}
              />
              <Separator />
              <InfoRow
                icon={Award}
                label="Thương hiệu"
                value={product.brand?.name}
              />
              <Separator />
              <InfoRow
                icon={MapPin}
                label="Xuất xứ"
                value={product.origin}
              />
            </CardContent>
          </Card>

          {/* Cosmetics / Supplements info */}
          {(product.batchNumber ||
            product.manufacturingDate ||
            product.expiryDate ||
            product.registrationNumber ||
            product.usageFunction) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mỹ phẩm / TPCN</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {product.batchNumber && (
                  <>
                    <InfoRow
                      icon={Hash}
                      label="Số lô"
                      value={product.batchNumber}
                      mono
                    />
                    <Separator />
                  </>
                )}
                {product.manufacturingDate && (
                  <>
                    <InfoRow
                      icon={CalendarDays}
                      label="Ngày sản xuất"
                      value={format(
                        new Date(product.manufacturingDate),
                        "dd/MM/yyyy"
                      )}
                    />
                    <Separator />
                  </>
                )}
                {product.expiryDate && (() => {
                  const daysLeft = differenceInDays(
                    new Date(product.expiryDate),
                    new Date()
                  );
                  const cls = daysLeft < 0
                    ? "text-destructive font-semibold"
                    : daysLeft <= 30
                    ? "text-orange-600 font-medium"
                    : "";
                  return (
                    <>
                      <InfoRow
                        icon={AlertTriangle}
                        label="Hạn sử dụng"
                        value={
                          <span className={cls}>
                            {format(new Date(product.expiryDate), "dd/MM/yyyy")}
                            {daysLeft >= 0 && daysLeft <= 90 && (
                              <span className="ml-2 text-xs">
                                (còn {daysLeft} ngày)
                              </span>
                            )}
                            {daysLeft < 0 && (
                              <span className="ml-2 text-xs">(đã hết hạn)</span>
                            )}
                          </span>
                        }
                      />
                      <Separator />
                    </>
                  );
                })()}
                {product.registrationNumber && (
                  <>
                    <InfoRow
                      icon={FileBadge}
                      label="Số đăng ký"
                      value={product.registrationNumber}
                      mono
                    />
                    <Separator />
                  </>
                )}
                {product.usageFunction && (
                  <InfoRow
                    icon={Sparkles}
                    label="Công dụng"
                    value={product.usageFunction}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Pricing + Stock + Metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pricing */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Giá cả</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <PriceCard
                  label="Giá bán"
                  value={product.sellingPrice}
                  accent="primary"
                />
                <PriceCard
                  label="Giá vốn"
                  value={product.costPrice}
                />
                <PriceCard
                  label="Biên lợi nhuận"
                  value=""
                  sub={`${margin.toFixed(1)}%`}
                  accent={margin < 0 ? "destructive" : undefined}
                />
                <PriceCard
                  label={`Thuế GTGT (${vatPercent}%)`}
                  value=""
                  sub={formatVND(sell * parseFloat(product.vatRate))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stock */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tồn kho</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border p-4 text-center">
                  <Warehouse className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Tồn hiện tại</p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      stock < min && min > 0 && "text-destructive"
                    )}
                  >
                    {stock.toLocaleString("vi-VN")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {product.baseUnit.name}
                  </p>
                </div>
                <div className="rounded-xl border p-4 text-center">
                  <TrendingDown className="h-5 w-5 mx-auto text-orange-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Tồn tối thiểu</p>
                  <p className="text-2xl font-bold mt-1">
                    {min.toLocaleString("vi-VN")}
                  </p>
                  {stock < min && min > 0 && (
                    <Badge variant="destructive" className="mt-1 text-[10px]">
                      Dưới định mức
                    </Badge>
                  )}
                </div>
                <div className="rounded-xl border p-4 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Tồn tối đa</p>
                  <p className="text-2xl font-bold mt-1">
                    {max.toLocaleString("vi-VN")}
                  </p>
                  {stock > max && max > 0 && (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      Vượt định mức
                    </Badge>
                  )}
                </div>
              </div>
              {/* Stock value */}
              <div className="mt-4 rounded-xl border bg-muted/30 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Giá trị tồn kho</p>
                  <p className="text-lg font-bold mt-0.5">
                    {formatVND(stock * cost)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Thông tin khác</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-x-8 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Mã hàng</span>
                  <span className="font-mono font-medium">{product.sku}</span>
                </div>
                {product.barcode && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Mã vạch</span>
                    <span className="font-mono font-medium">{product.barcode}</span>
                  </div>
                )}
                {product.nameEn && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Tên tiếng Anh</span>
                    <span className="font-medium">{product.nameEn}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Ngày tạo</span>
                  <span>
                    {format(new Date(product.createdAt), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Cập nhật lần cuối</span>
                  <span>
                    {format(new Date(product.updatedAt), "dd/MM/yyyy HH:mm")}
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
        itemName={product.name}
        itemCode={product.sku}
        onConfirm={handleDelete}
      />
    </div>
  );
}
