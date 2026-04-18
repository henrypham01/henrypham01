"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  Trash2,
  Search,
  Printer,
  Save,
  X,
  ArrowLeft,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api-error";
import { formatVND } from "@/lib/formatting";
import { printInvoice } from "@/lib/print-invoice";

type Customer = { id: string; name: string; code: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: string;
  vatRate: string;
  currentStock: string;
  imageUrl: string | null;
  baseUnit?: { id: string; name: string } | null;
};

type LineItem = {
  tempId: string;
  productId: string;
  productName: string;
  productSku: string;
  productUnit: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  vatRate: string;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { locale } = useParams();

  const [customerId, setCustomerId] = useState("");
  // Header discount is expressed as a percentage of subtotal — matches the
  // purchase-order page's UX.
  const [discountPercent, setDiscountPercent] = useState("0");
  // Shipping fee (VND, absolute). Added to total after discount + VAT.
  const [shippingFee, setShippingFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRefs = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/products"),
    ]);
    setCustomers(await cRes.json());
    setProducts(await pRes.json());
  }, []);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  const addItem = (product: Product) => {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: String(parseFloat(i.quantity || "0") + 1) }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          tempId: crypto.randomUUID(),
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productUnit: product.baseUnit?.name || "",
          quantity: "1",
          unitPrice: product.sellingPrice || "0",
          discountAmount: "0",
          vatRate: product.vatRate || "0.1",
        },
      ]);
    }
    setSearchQuery("");
    setSearchOpen(false);
  };

  const updateItem = (
    tempId: string,
    field: "quantity" | "unitPrice" | "discountAmount" | "vatRate",
    value: string
  ) => {
    setItems(
      items.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter((i) => i.tempId !== tempId));
  };

  // Calculations
  const { subtotal, vatAmount, lineDiscounts } = useMemo(() => {
    let sub = 0;
    let vat = 0;
    let lineDisc = 0;
    for (const i of items) {
      const qty = parseFloat(i.quantity || "0");
      const price = parseFloat(i.unitPrice || "0");
      const base = qty * price;
      const disc = parseFloat(i.discountAmount || "0");
      const afterDisc = Math.max(0, base - disc);
      sub += afterDisc;
      vat += afterDisc * parseFloat(i.vatRate || "0");
      lineDisc += disc;
    }
    return { subtotal: sub, vatAmount: vat, lineDiscounts: lineDisc };
  }, [items]);

  const discountPercentNum = Math.max(
    0,
    Math.min(100, parseFloat(discountPercent || "0") || 0)
  );
  const headerDiscount = subtotal * (discountPercentNum / 100);
  const totalDiscount = lineDiscounts + headerDiscount;
  const shippingFeeNum = Math.max(0, parseFloat(shippingFee || "0") || 0);
  const total = Math.max(
    0,
    subtotal - headerDiscount + vatAmount + shippingFeeNum
  );

  // Typeahead: only show results when user typed something.
  const trimmedQuery = searchQuery.trim();
  const matchedProducts = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [products, trimmedQuery]);

  const handleOpenPay = () => {
    if (!customerId) return toast.error("Vui lòng chọn khách hàng");
    if (items.length === 0) return toast.error("Cần ít nhất 1 mặt hàng");
    if (items.some((i) => parseFloat(i.quantity) <= 0))
      return toast.error("Số lượng phải lớn hơn 0");
    setPayOpen(true);
  };

  const createInvoice = async (printed: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          // Server expects an amount — convert % to absolute on send.
          discountAmount: headerDiscount,
          shippingFee: shippingFeeNum,
          notes: notes || null,
          lineItems: items.map((i) => {
            const qty = parseFloat(i.quantity);
            const price = parseFloat(i.unitPrice);
            const discAmt = parseFloat(i.discountAmount || "0");
            // Convert per-line discount amount back to a percent so it
            // matches the API schema (discountPercent on lineItem).
            const base = qty * price;
            const discountPercent =
              base > 0 ? Math.min(100, (discAmt / base) * 100) : 0;
            return {
              productId: i.productId,
              quantity: qty,
              unitPrice: price,
              discountPercent,
              vatRate: parseFloat(i.vatRate || "0.1"),
            };
          }),
          printed,
        }),
      });

      if (!res.ok) {
        toast.error(await parseApiError(res, "Tạo hoá đơn thất bại"));
        return;
      }

      const inv = await res.json();
      if (inv.warnings && inv.warnings.length > 0) {
        toast.warning(`Cảnh báo tồn kho: ${inv.warnings.length} mặt hàng`);
      }
      toast.success(printed ? "Đã tạo hoá đơn & in" : "Đã lưu hoá đơn");

      if (printed) {
        // Fire-and-forget silent print. In Electron we talk directly to the
        // configured K80 printer (Xprinter XP-H200U by default); in a browser
        // this opens the chromeless print page and invokes the native dialog.
        try {
          await printInvoice(inv.id, "k80", {
            locale: String(locale || "vi"),
          });
        } catch (err) {
          console.error("printInvoice failed:", err);
          toast.error("Đã lưu nhưng in thất bại — mở lại hoá đơn để in tay");
        }
      }
      router.push(`/${locale}/invoices`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/invoices`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">
            Tạo hoá đơn
          </h1>
        </div>
      </div>

      {/* 75/25 split on lg+, stacked on mobile/tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* Left column (~75%): product list */}
        <div className="lg:col-span-3">
          {/*
            overflow-visible: the product search dropdown is absolute-positioned
            below the input and otherwise gets clipped by Card's default
            overflow-hidden (which is there to round image corners).
          */}
          <Card className="overflow-visible">
            <CardContent className="p-4">
              {/* Toolbar: title + typeahead search (image, name, stock) */}
              <div className="mb-3 flex items-center gap-2">
                <Label className="text-sm font-semibold shrink-0">
                  Hàng hoá
                </Label>
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Tìm sản phẩm theo tên, mã..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onBlur={() => {
                      // Defer so onClick on a result fires before unmount.
                      setTimeout(() => setSearchOpen(false), 150);
                    }}
                    className="h-8 pl-8"
                  />
                  {searchOpen && trimmedQuery.length > 0 && (
                    <div
                      // Max height ≈ 5 rows × 57px (observed row height).
                      // When there are more than 5 matches the list scrolls
                      // inside the popup rather than pushing the page.
                      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[290px] overflow-y-auto overscroll-contain rounded-md border bg-popover shadow-md"
                    >
                      {matchedProducts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          Không tìm thấy sản phẩm nào
                        </div>
                      ) : (
                        matchedProducts.map((p) => {
                          const stock = parseFloat(p.currentStock || "0");
                          const unit = p.baseUnit?.name ?? "";
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => addItem(p)}
                              className="flex w-full items-center gap-3 border-b px-2.5 py-2 text-left last:border-b-0 hover:bg-accent"
                            >
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                                {p.imageUrl ? (
                                  <Image
                                    src={p.imageUrl}
                                    alt={p.name}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground/50" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                  {p.name}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  <span className="font-mono">{p.sku}</span>
                                  <span className="mx-1.5 opacity-50">•</span>
                                  <span
                                    className={
                                      stock <= 0
                                        ? "text-destructive font-medium"
                                        : ""
                                    }
                                  >
                                    Tồn: {stock.toLocaleString("vi-VN")}
                                    {unit ? ` ${unit}` : ""}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 text-right text-xs text-muted-foreground">
                                {formatVND(p.sellingPrice)}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-blue-50 text-foreground">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-semibold w-12">
                        STT
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold">
                        Mã hàng
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold">
                        Tên hàng
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold w-20">
                        ĐVT
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-28">
                        Số lượng
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-36">
                        Đơn giá
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-36">
                        Giảm giá
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-32">
                        Thành tiền
                      </th>
                      <th className="py-2 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center text-muted-foreground py-8 text-xs"
                        >
                          Chưa có hàng hoá nào — hãy tìm sản phẩm
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const qty = parseFloat(item.quantity || "0");
                        const price = parseFloat(item.unitPrice || "0");
                        const base = qty * price;
                        const disc = parseFloat(item.discountAmount || "0");
                        const afterDisc = Math.max(0, base - disc);
                        const vat = afterDisc * parseFloat(item.vatRate || "0");
                        const lineTotal = afterDisc + vat;
                        return (
                          <tr key={item.tempId} className="border-t">
                            <td className="py-2 px-3 text-xs text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">
                              {item.productSku}
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-medium text-sm">
                                {item.productName}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-muted-foreground">
                              {item.productUnit || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    item.tempId,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                min="0"
                                step="1000"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateItem(
                                    item.tempId,
                                    "unitPrice",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                min="0"
                                step="1000"
                                value={item.discountAmount}
                                onChange={(e) =>
                                  updateItem(
                                    item.tempId,
                                    "discountAmount",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {formatVND(lineTotal)}
                            </td>
                            <td className="py-2 px-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.tempId)}
                                aria-label="Xoá"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column (~25%): customer + totals + actions. Sticky on desktop. */}
        <aside className="lg:col-span-1 lg:sticky lg:top-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Khách hàng *</Label>
                <SearchableSelect
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name}${c.code ? ` (${c.code})` : ""}`,
                  }))}
                  value={customerId}
                  onValueChange={setCustomerId}
                  placeholder="- Chọn khách hàng -"
                  searchPlaceholder="Tìm khách hàng..."
                  emptyText="Không tìm thấy"
                />
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="pt-2 border-t">
                <Label>Chiết khấu (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="0"
                    className="pr-8 text-right"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div>
                <Label>Phí ship</Label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1000"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    placeholder="0"
                    className="pr-10 text-right"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    đ
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng tiền hàng:</span>
                <span className="font-medium">{formatVND(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Chiết khấu
                  {discountPercentNum > 0 && (
                    <span className="ml-1 text-xs">
                      ({discountPercentNum}%)
                    </span>
                  )}
                  :
                </span>
                <span className="font-medium">
                  {formatVND(totalDiscount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thuế GTGT:</span>
                <span className="font-medium">{formatVND(vatAmount)}</span>
              </div>
              {shippingFeeNum > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phí ship:</span>
                  <span className="font-medium">
                    {formatVND(shippingFeeNum)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Tổng thanh toán:</span>
                <span className="font-bold text-lg text-primary">
                  {formatVND(total)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={handleOpenPay}
              className="w-full"
            >
              Thanh toán
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
            >
              Huỷ
            </Button>
          </div>
        </aside>
      </div>

      {/* Payment popup */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận thanh toán</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">Tổng thanh toán</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {formatVND(total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {items.length} mặt hàng · lưu đơn + trừ kho ngay
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => createInvoice(true)}
                disabled={saving}
                size="lg"
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                In ngay
              </Button>
              <Button
                onClick={() => createInvoice(false)}
                disabled={saving}
                variant="secondary"
                size="lg"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Lưu / Đóng
              </Button>
              <Button
                onClick={() => setPayOpen(false)}
                disabled={saving}
                variant="ghost"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Quay lại
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
