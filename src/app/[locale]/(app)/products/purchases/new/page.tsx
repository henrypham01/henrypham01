"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Trash2, Search, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { formatVND } from "@/lib/formatting";
import { CurrencyInput } from "@/components/shared/currency-input";

type Supplier = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  costPrice: string;
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
  costPrice: string;
  discountAmount: string;
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { locale } = useParams();

  const [code, setCode] = useState("");
  const [supplierId, setSupplierId] = useState("");
  // Header-level discount expressed as a percentage of the subtotal (0-100).
  const [discountPercent, setDiscountPercent] = useState("0");
  const [totalPaid, setTotalPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchRefs = useCallback(async () => {
    const [sRes, pRes, ncRes] = await Promise.all([
      fetch("/api/suppliers"),
      fetch("/api/products"),
      fetch("/api/purchase-orders/next-code"),
    ]);
    setSuppliers(await sRes.json());
    setProducts(await pRes.json());
    const nc = await ncRes.json();
    setCode(nc.code);
  }, []);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  const addItem = (product: Product) => {
    // If already exists, increment quantity
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
          costPrice: product.costPrice || "0",
          discountAmount: "0",
        },
      ]);
    }
    setSearchQuery("");
    setSearchOpen(false);
  };

  const updateItem = (
    tempId: string,
    field: "quantity" | "costPrice" | "discountAmount",
    value: string
  ) => {
    setItems(items.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i)));
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter((i) => i.tempId !== tempId));
  };

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, i) => s + parseFloat(i.quantity || "0") * parseFloat(i.costPrice || "0"),
        0
      ),
    [items]
  );

  // Sum of per-line discounts (column "Giảm giá")
  const lineDiscounts = useMemo(
    () => items.reduce((s, i) => s + parseFloat(i.discountAmount || "0"), 0),
    [items]
  );

  // Header discount is a percentage of (subtotal − line discounts). Clamp
  // to [0, 100] so bad input can't drive total negative.
  const discountPercentNum = Math.max(
    0,
    Math.min(100, parseFloat(discountPercent || "0") || 0)
  );
  const baseForHeaderDiscount = Math.max(0, subtotal - lineDiscounts);
  const headerDiscount = baseForHeaderDiscount * (discountPercentNum / 100);
  const discount = lineDiscounts + headerDiscount;
  const totalAmount = Math.max(0, subtotal - discount);
  const paid = parseFloat(totalPaid || "0");
  const debt = totalAmount - paid;

  // Typeahead over the product catalog for the toolbar search field.
  // Only computes results when the user has typed something — focusing the
  // empty field does NOT show any list.
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

  const handleSave = async (complete: boolean) => {
    if (items.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 mặt hàng");
      return;
    }
    if (items.some((i) => parseFloat(i.quantity) <= 0)) {
      toast.error("Số lượng phải lớn hơn 0");
      return;
    }
    if (paid > totalAmount) {
      toast.error("Đã trả không được lớn hơn tổng tiền");
      return;
    }

    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        supplierId: supplierId || null,
        discountAmount: discount,
        totalPaid: paid,
        notes: notes || null,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: parseFloat(i.quantity),
          costPrice: parseFloat(i.costPrice),
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(
        typeof err.error === "string"
          ? err.error
          : Object.values(err.error).flat().join(", ")
      );
      return;
    }

    const order = await res.json();

    if (complete) {
      const cRes = await fetch(`/api/purchase-orders/${order.id}/complete`, {
        method: "PATCH",
      });
      if (!cRes.ok) {
        const err = await cRes.json();
        toast.error(err.error || "Không thể xác nhận");
        return;
      }
    }

    toast.success(complete ? "Đã nhập hàng thành công" : "Đã lưu phiếu nháp");
    router.push(`/${locale}/products/purchases`);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <h1 className="text-lg md:text-xl font-semibold tracking-tight">Tạo phiếu nhập hàng</h1>
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
              {/* Toolbar: title + product typeahead (shows image, name, stock) */}
              <div className="mb-3 flex items-center gap-2">
                <Label className="text-sm font-semibold shrink-0">Hàng hoá</Label>
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
                      // Defer so an onClick on a result fires before the
                      // dropdown unmounts.
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
                              // Prevent input blur so onClick fires reliably.
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
                                {formatVND(p.costPrice)}
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
                      <th className="py-2 px-3 text-left text-xs font-semibold w-12">STT</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold">Mã hàng</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold">Tên hàng</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold w-20">ĐVT</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-28">Số lượng</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-36">Đơn giá</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-36">Giảm giá</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold w-32">Thành tiền</th>
                      <th className="py-2 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-muted-foreground py-8 text-xs">
                          Chưa có hàng hoá nào
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const gross =
                          parseFloat(item.quantity || "0") *
                          parseFloat(item.costPrice || "0");
                        const lineDiscount = parseFloat(item.discountAmount || "0");
                        const lineTotal = Math.max(0, gross - lineDiscount);
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
                                  updateItem(item.tempId, "quantity", e.target.value)
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <CurrencyInput
                                value={item.costPrice}
                                onChange={(v) =>
                                  updateItem(item.tempId, "costPrice", v)
                                }
                              />
                            </td>
                            <td className="py-2 px-3">
                              <CurrencyInput
                                value={item.discountAmount}
                                onChange={(v) =>
                                  updateItem(item.tempId, "discountAmount", v)
                                }
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

        {/* Right column (~25%): invoice info + totals + actions. Sticky on desktop. */}
        <aside className="lg:col-span-1 lg:sticky lg:top-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Mã phiếu</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div>
                <Label>Nhà cung cấp</Label>
                <SearchableSelect
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  value={supplierId}
                  onValueChange={setSupplierId}
                  placeholder="- Chọn nhà cung cấp -"
                  searchPlaceholder="Tìm nhà cung cấp..."
                  emptyText="Không tìm thấy"
                />
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                <Label>Đã thanh toán</Label>
                <CurrencyInput value={totalPaid} onChange={setTotalPaid} />
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
                <span className="font-medium">{formatVND(discount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Tổng thanh toán:</span>
                <span className="font-bold text-lg">{formatVND(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã trả:</span>
                <span>{formatVND(paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Còn nợ:</span>
                <span className={debt > 0 ? "text-orange-600 font-medium" : ""}>
                  {formatVND(debt)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSave(true)} className="w-full">
              Xác nhận nhập hàng
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              className="w-full"
            >
              Lưu nháp
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
    </div>
  );
}
