"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Undo2,
  XCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Supplier = { id: string; name: string };
type ProductRef = {
  id: string;
  sku: string;
  name: string;
  costPrice: string;
  currentStock: string;
};

type OrderItem = {
  id: string;
  productId: string;
  product: { id: string; sku: string; name: string };
  quantity: string;
  costPrice: string;
  lineTotal: string;
};

type ReturnData = {
  id: string;
  code: string;
  returnDate: string;
  reason: string | null;
  totalAmount: string;
  items: {
    id: string;
    productId: string;
    product: { name: string; sku: string };
    quantity: string;
    costPrice: string;
    lineTotal: string;
  }[];
  createdBy: { fullName: string } | null;
};

type Order = {
  id: string;
  code: string;
  status: "DRAFT" | "COMPLETED" | "CANCELLED" | "RETURNED";
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  totalPaid: string;
  notes: string | null;
  items: OrderItem[];
  returns: ReturnData[];
  createdBy: { id: string; fullName: string } | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LineItem = {
  tempId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: string;
  costPrice: string;
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Phác thảo", variant: "secondary" },
  COMPLETED: { label: "Hoàn thành", variant: "default" },
  CANCELLED: { label: "Đã huỷ", variant: "destructive" },
  RETURNED: { label: "Đã trả hàng", variant: "outline" },
};

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const { locale, id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);

  // Edit state (DRAFT only)
  const [supplierId, setSupplierId] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [totalPaid, setTotalPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  // Refs for edit mode
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // Dialogs
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnItems, setReturnItems] = useState<
    { productId: string; quantity: string; costPrice: number; maxQty: number }[]
  >([]);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/purchase-orders/${id}`);
    if (!res.ok) {
      router.replace(`/${locale}/products/purchases`);
      return;
    }
    const data: Order = await res.json();
    setOrder(data);

    // Populate edit state
    setSupplierId(data.supplierId || "");
    setDiscountAmount(data.discountAmount);
    setTotalPaid(data.totalPaid);
    setNotes(data.notes || "");
    setItems(
      data.items.map((i) => ({
        tempId: i.id,
        productId: i.productId,
        productName: i.product.name,
        productSku: i.product.sku,
        quantity: String(Number(i.quantity)),
        costPrice: String(Number(i.costPrice)),
      }))
    );
  }, [id, locale, router]);

  const fetchRefs = useCallback(async () => {
    const [sRes, pRes] = await Promise.all([
      fetch("/api/suppliers"),
      fetch("/api/products"),
    ]);
    setSuppliers(await sRes.json());
    setProducts(await pRes.json());
  }, []);

  useEffect(() => {
    fetchOrder();
    fetchRefs();
  }, [fetchOrder, fetchRefs]);

  const isEditable = order?.status === "DRAFT";

  // --- Edit mode helpers ---
  const addItem = (product: ProductRef) => {
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
          quantity: "1",
          costPrice: product.costPrice || "0",
        },
      ]);
    }
    setProductPickerOpen(false);
  };

  const updateItem = (
    tempId: string,
    field: "quantity" | "costPrice",
    value: string
  ) => {
    setItems(
      items.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter((i) => i.tempId !== tempId));
  };

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, i) =>
          s + parseFloat(i.quantity || "0") * parseFloat(i.costPrice || "0"),
        0
      ),
    [items]
  );

  const discount = parseFloat(discountAmount || "0");
  const totalAmount = Math.max(0, subtotal - discount);
  const paid = parseFloat(totalPaid || "0");
  const debt = totalAmount - paid;

  // --- Actions ---
  const handleSave = async () => {
    if (items.length === 0) return toast.error("Cần ít nhất 1 mặt hàng");
    if (items.some((i) => parseFloat(i.quantity) <= 0))
      return toast.error("Số lượng phải lớn hơn 0");
    if (paid > totalAmount)
      return toast.error("Đã trả không được lớn hơn tổng tiền");

    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      return toast.error(
        typeof err.error === "string"
          ? err.error
          : Object.values(err.error).flat().join(", ")
      );
    }
    toast.success("Đã cập nhật phiếu");
    fetchOrder();
  };

  const handleComplete = async () => {
    // Save first then complete
    if (items.length === 0) return toast.error("Cần ít nhất 1 mặt hàng");
    await handleSave();
    const res = await fetch(`/api/purchase-orders/${id}/complete`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const err = await res.json();
      return toast.error(err.error || "Lỗi");
    }
    toast.success("Đã xác nhận nhập hàng");
    fetchOrder();
  };

  const handleCancel = async () => {
    const res = await fetch(`/api/purchase-orders/${id}/cancel`, {
      method: "PATCH",
    });
    if (res.ok) {
      toast.success("Đã huỷ phiếu");
      setCancelOpen(false);
      fetchOrder();
    } else {
      const err = await res.json();
      toast.error(err.error || "Lỗi");
    }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Đã xoá phiếu");
      router.replace(`/${locale}/products/purchases`);
    } else {
      const err = await res.json();
      toast.error(err.error || "Lỗi");
    }
  };

  // --- Return helpers ---
  const openReturn = () => {
    if (!order) return;
    // Calculate already-returned qty per product
    const returnedQty: Record<string, number> = {};
    for (const ret of order.returns) {
      for (const ri of ret.items) {
        returnedQty[ri.productId] =
          (returnedQty[ri.productId] || 0) + Number(ri.quantity);
      }
    }
    setReturnItems(
      order.items
        .map((oi) => {
          const maxQty =
            Number(oi.quantity) - (returnedQty[oi.productId] || 0);
          return {
            productId: oi.productId,
            quantity: maxQty > 0 ? String(maxQty) : "0",
            costPrice: Number(oi.costPrice),
            maxQty,
          };
        })
        .filter((i) => i.maxQty > 0)
    );
    setReturnReason("");
    setReturnOpen(true);
  };

  const handleReturn = async () => {
    const validItems = returnItems.filter(
      (i) => parseFloat(i.quantity) > 0
    );
    if (validItems.length === 0) {
      return toast.error("Vui lòng nhập số lượng trả");
    }
    const res = await fetch(`/api/purchase-orders/${id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: returnReason || null,
        items: validItems.map((i) => ({
          productId: i.productId,
          quantity: parseFloat(i.quantity),
          costPrice: i.costPrice,
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      return toast.error(
        typeof err.error === "string"
          ? err.error
          : Object.values(err.error).flat().join(", ")
      );
    }
    toast.success("Đã tạo phiếu trả hàng");
    setReturnOpen(false);
    fetchOrder();
  };

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  const st = statusConfig[order.status];

  // Read-only values for non-editable
  const roSubtotal = Number(order.subtotal);
  const roDiscount = Number(order.discountAmount);
  const roTotal = Number(order.totalAmount);
  const roPaid = Number(order.totalPaid);
  const roDebt = roTotal - roPaid;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/products/purchases`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                {order.code}
              </h1>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              {order.createdBy && (
                <span>Người tạo: {order.createdBy.fullName}</span>
              )}
              <span>
                Ngày tạo:{" "}
                {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}
              </span>
              {order.completedAt && (
                <span>
                  Hoàn thành:{" "}
                  {format(new Date(order.completedAt), "dd/MM/yyyy HH:mm")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEditable && (
            <>
              <Button size="sm" variant="secondary" onClick={handleSave}>
                Lưu
              </Button>
              <Button size="sm" onClick={handleComplete} className="gap-1.5">
                <Check className="h-4 w-4" />
                Xác nhận nhập
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Huỷ
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Xoá
              </Button>
            </>
          )}
          {order.status === "COMPLETED" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Huỷ phiếu
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={openReturn}
                className="gap-1.5"
              >
                <Undo2 className="h-4 w-4" />
                Trả hàng
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Supplier + Notes */}
      {isEditable ? (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Nhà cung cấp</Label>
                <SearchableSelect
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  value={supplierId}
                  onValueChange={setSupplierId}
                  placeholder="- Chọn nhà cung cấp -"
                  searchPlaceholder="Tìm nhà cung cấp..."
                  emptyText="Không tìm thấy"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Ghi chú</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Nhà cung cấp</p>
                <p className="font-medium mt-0.5">
                  {order.supplier?.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Người tạo</p>
                <p className="font-medium mt-0.5">
                  {order.createdBy?.fullName || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ngày tạo</p>
                <p className="font-medium mt-0.5">
                  {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              {order.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Ghi chú</p>
                  <p className="font-medium mt-0.5">{order.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-sm font-semibold">Hàng hoá</Label>
            {isEditable && (
              <Popover
                open={productPickerOpen}
                onOpenChange={setProductPickerOpen}
              >
                <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs hover:bg-accent">
                  <Plus className="h-3.5 w-3.5" />
                  Thêm hàng
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <Command
                    filter={(val, search) =>
                      val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Tìm theo mã, tên..." />
                    <CommandList>
                      <CommandEmpty>Không tìm thấy</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.sku} ${p.name}`}
                            onSelect={() => addItem(p)}
                          >
                            <Search className="mr-2 h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-xs">{p.sku}</span>
                            <span className="ml-2 truncate">{p.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    #
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Hàng hoá
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Số lượng
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Giá nhập
                  </th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Thành tiền
                  </th>
                  {isEditable && <th className="py-2 px-3"></th>}
                </tr>
              </thead>
              <tbody>
                {isEditable
                  ? items.length === 0
                    ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-muted-foreground py-6 text-xs"
                        >
                          Chưa có hàng hoá nào
                        </td>
                      </tr>
                    )
                    : items.map((item, idx) => {
                        const lineTotal =
                          parseFloat(item.quantity || "0") *
                          parseFloat(item.costPrice || "0");
                        return (
                          <tr key={item.tempId} className="border-t">
                            <td className="py-2 px-3 text-xs text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-medium text-sm">
                                {item.productName}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.productSku}
                              </div>
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
                                className="h-8 text-right w-24 ml-auto"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <div className="w-32 ml-auto">
                                <CurrencyInput
                                  value={item.costPrice}
                                  onChange={(v) =>
                                    updateItem(item.tempId, "costPrice", v)
                                  }
                                />
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {formatVND(lineTotal)}
                            </td>
                            <td className="py-2 px-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.tempId)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                  : order.items.map((item, idx) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-sm">
                            {item.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {item.product.sku}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {Number(item.quantity).toLocaleString("vi-VN")}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatVND(item.costPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatVND(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {isEditable ? (
              <div className="space-y-3">
                <div>
                  <Label>Chiết khấu</Label>
                  <CurrencyInput
                    value={discountAmount}
                    onChange={setDiscountAmount}
                  />
                </div>
                <div>
                  <Label>Đã thanh toán</Label>
                  <CurrencyInput value={totalPaid} onChange={setTotalPaid} />
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng tiền hàng:</span>
                <span className="font-medium">
                  {formatVND(isEditable ? subtotal : roSubtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chiết khấu:</span>
                <span className="font-medium">
                  {formatVND(isEditable ? discount : roDiscount)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Tổng thanh toán:</span>
                <span className="font-bold text-lg">
                  {formatVND(isEditable ? totalAmount : roTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã trả:</span>
                <span>{formatVND(isEditable ? paid : roPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Còn nợ:</span>
                <span
                  className={cn(
                    (isEditable ? debt : roDebt) > 0 &&
                      "text-orange-600 font-medium"
                  )}
                >
                  {formatVND(isEditable ? debt : roDebt)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returns history */}
      {order.returns.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lịch sử trả hàng</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {order.returns.map((ret) => (
                <div key={ret.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-medium">{ret.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ret.returnDate), "dd/MM/yyyy HH:mm")}
                      {ret.createdBy && ` - ${ret.createdBy.fullName}`}
                    </span>
                  </div>
                  {ret.reason && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Lý do: {ret.reason}
                    </p>
                  )}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1">Hàng hoá</th>
                        <th className="text-right py-1">SL trả</th>
                        <th className="text-right py-1">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ret.items.map((ri) => (
                        <tr key={ri.id} className="border-t">
                          <td className="py-1">{ri.product.name}</td>
                          <td className="py-1 text-right">
                            {Number(ri.quantity)}
                          </td>
                          <td className="py-1 text-right">
                            {formatVND(ri.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-medium">
                        <td colSpan={2} className="py-1 text-right">
                          Tổng:
                        </td>
                        <td className="py-1 text-right">
                          {formatVND(ret.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel confirm */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Huỷ phiếu nhập"
        message={
          order.status === "COMPLETED"
            ? "Huỷ phiếu đã hoàn thành sẽ hoàn trả tồn kho. Bạn có chắc chắn?"
            : "Bạn có chắc chắn muốn huỷ phiếu nhập này?"
        }
        itemCode={order.code}
        confirmLabel="Huỷ phiếu"
        onConfirm={handleCancel}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá phiếu nhập"
        message="Bạn có chắc chắn muốn xoá phiếu nhập này? Hành động này không thể hoàn tác."
        itemCode={order.code}
        onConfirm={handleDelete}
      />

      {/* Return dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trả hàng nhập - {order.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Hàng hoá
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Tối đa
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      SL trả
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Giá nhập
                    </th>
                    <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.map((ri, idx) => {
                    const prod = order.items.find(
                      (oi) => oi.productId === ri.productId
                    );
                    const lineTotal =
                      parseFloat(ri.quantity || "0") * ri.costPrice;
                    return (
                      <tr key={ri.productId} className="border-t">
                        <td className="py-2 px-3">
                          <div className="font-medium">
                            {prod?.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {prod?.product.sku}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {ri.maxQty}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="0"
                            max={ri.maxQty}
                            value={ri.quantity}
                            onChange={(e) => {
                              const next = [...returnItems];
                              next[idx] = {
                                ...next[idx],
                                quantity: e.target.value,
                              };
                              setReturnItems(next);
                            }}
                            className="h-8 text-right w-24 ml-auto"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatVND(ri.costPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatVND(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <Label>Lý do trả hàng</Label>
              <Textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Nhập lý do trả hàng..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReturnOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleReturn}>Xác nhận trả hàng</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
