"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { CurrencyInput } from "@/components/shared/currency-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Printer,
  Save,
  XCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api-error";
import { formatVND } from "@/lib/formatting";
import { printInvoice as triggerPrint } from "@/lib/print-invoice";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Customer = { id: string; name: string; code: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: string;
  vatRate: string;
  currentStock: string;
};

type Invoice = {
  id: string;
  documentNumber: string;
  customerId: string;
  customer: { id: string; name: string; code: string };
  status: "CHO_IN" | "DA_IN" | "CANCELLED";
  issueDate: string;
  printedAt: string | null;
  notes: string | null;
  subtotal: string;
  discountAmount: string;
  vatAmount: string;
  shippingFee: string;
  totalAmount: string;
  paidAmount: string;
  createdAt: string;
  lineItems: {
    id: string;
    productId: string;
    product: { id: string; sku: string; name: string };
    quantity: string;
    unitPrice: string;
    discountPercent: string;
    vatRate: string;
    lineTotal: string;
  }[];
};

type LineItem = {
  tempId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  vatRate: string;
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  CHO_IN: { label: "Chờ in", variant: "secondary" },
  DA_IN: { label: "Đã in", variant: "default" },
  CANCELLED: { label: "Đã huỷ", variant: "destructive" },
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { locale, id } = useParams();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";

  const [invoice, setInvoice] = useState<Invoice | null>(null);

  // Edit state (only when CHO_IN)
  const [customerId, setCustomerId] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchInvoice = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) {
      router.replace(`/${locale}/invoices`);
      return;
    }
    const data: Invoice = await res.json();
    setInvoice(data);
    setCustomerId(data.customerId);
    setDiscountAmount(data.discountAmount);
    setNotes(data.notes || "");
    setItems(
      data.lineItems.map((li) => ({
        tempId: li.id,
        productId: li.productId,
        productName: li.product.name,
        productSku: li.product.sku,
        quantity: String(Number(li.quantity)),
        unitPrice: String(Number(li.unitPrice)),
        discountPercent: String(Number(li.discountPercent)),
        vatRate: String(Number(li.vatRate)),
      }))
    );
  }, [id, locale, router]);

  const fetchRefs = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/products"),
    ]);
    setCustomers(await cRes.json());
    setProducts(await pRes.json());
  }, []);

  useEffect(() => {
    fetchInvoice();
    fetchRefs();
  }, [fetchInvoice, fetchRefs]);

  // Auto-trigger print when ?print=1 after invoice loads — back-compat path
  // for legacy ?print=1 links. The create-invoice flow now calls
  // `triggerPrint()` directly without navigating here.
  useEffect(() => {
    if (invoice && autoPrint && invoice.status !== "CANCELLED") {
      const t = setTimeout(() => {
        triggerPrint(invoice.id, "k80", { locale: String(locale || "vi") });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [invoice, autoPrint, locale]);

  const editable = invoice?.status === "CHO_IN";

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
          quantity: "1",
          unitPrice: product.sellingPrice || "0",
          discountPercent: "0",
          vatRate: product.vatRate || "0.1",
        },
      ]);
    }
    setProductPickerOpen(false);
  };

  const updateItem = (tempId: string, field: keyof LineItem, value: string) => {
    setItems(items.map((i) => (i.tempId === tempId ? { ...i, [field]: value } : i)));
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter((i) => i.tempId !== tempId));
  };

  const { subtotal, vatAmount, total } = useMemo(() => {
    let sub = 0;
    let vat = 0;
    for (const i of items) {
      const base = parseFloat(i.quantity || "0") * parseFloat(i.unitPrice || "0");
      const disc = base * (parseFloat(i.discountPercent || "0") / 100);
      const afterDisc = base - disc;
      sub += afterDisc;
      vat += afterDisc * parseFloat(i.vatRate || "0");
    }
    return {
      subtotal: sub,
      vatAmount: vat,
      total: sub - parseFloat(discountAmount || "0") + vat,
    };
  }, [items, discountAmount]);

  const handleSaveEdit = async () => {
    if (!customerId) return toast.error("Vui lòng chọn khách hàng");
    if (items.length === 0) return toast.error("Cần ít nhất 1 mặt hàng");
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${id}?action=edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          discountAmount: parseFloat(discountAmount || "0"),
          notes: notes || null,
          lineItems: items.map((i) => ({
            productId: i.productId,
            quantity: parseFloat(i.quantity),
            unitPrice: parseFloat(i.unitPrice),
            discountPercent: parseFloat(i.discountPercent || "0"),
            vatRate: parseFloat(i.vatRate || "0.1"),
          })),
        }),
      });
      if (!res.ok) {
        toast.error(await parseApiError(res, "Lưu thất bại"));
        return;
      }
      toast.success("Đã lưu hoá đơn");
      fetchInvoice();
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (size: "k80" | "a6") => {
    if (!invoice) return;
    if (invoice.status === "CHO_IN") {
      const res = await fetch(`/api/invoices/${id}?action=print`, {
        method: "PUT",
      });
      if (!res.ok) {
        toast.error(await parseApiError(res, "In thất bại"));
        return;
      }
      toast.success("Đã chuyển sang trạng thái Đã in");
      await fetchInvoice();
    }
    await triggerPrint(invoice.id, size, { locale: String(locale || "vi") });
  };

  const handleCancel = async () => {
    const res = await fetch(`/api/invoices/${id}?action=cancel`, { method: "PUT" });
    if (!res.ok) {
      toast.error(await parseApiError(res, "Huỷ thất bại"));
      return;
    }
    toast.success("Đã huỷ hoá đơn & hoàn kho");
    setCancelOpen(false);
    fetchInvoice();
  };

  if (!invoice) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  const st = statusConfig[invoice.status];

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/invoices`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                {invoice.documentNumber}
              </h1>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>
                Ngày tạo: {format(new Date(invoice.createdAt), "dd/MM/yyyy HH:mm")}
              </span>
              {invoice.printedAt && (
                <span>
                  Đã in: {format(new Date(invoice.printedAt), "dd/MM/yyyy HH:mm")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {editable && (
            <Button size="sm" variant="secondary" onClick={handleSaveEdit} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              Lưu
            </Button>
          )}
          {invoice.status !== "CANCELLED" && (
            <>
              <Button
                size="sm"
                onClick={() => handlePrint("k80")}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                {invoice.status === "DA_IN" ? "In lại K80" : "In K80"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrint("a6")}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                In A6
              </Button>
            </>
          )}
          {invoice.status !== "CANCELLED" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCancelOpen(true)}
              className="gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              Huỷ phiếu
            </Button>
          )}
        </div>
      </div>

      {invoice.status === "CANCELLED" && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Hoá đơn này đã huỷ — kho đã được hoàn trả.
        </div>
      )}

      {/* Customer + notes */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Khách hàng</Label>
              {editable ? (
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
              ) : (
                <p className="font-medium mt-1">{invoice.customer.name}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Ghi chú</Label>
              {editable ? (
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              ) : (
                <p className="font-medium mt-1">{invoice.notes || "-"}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-sm font-semibold">Hàng hoá</Label>
            {editable && (
              <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs hover:bg-accent">
                  <Plus className="h-3.5 w-3.5" />
                  Tìm sản phẩm
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="end">
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
                            <span className="ml-2 truncate flex-1">{p.name}</span>
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
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase">Hàng hoá</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">SL</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">Đơn giá</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">CK %</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground uppercase">Thành tiền</th>
                  {editable && <th className="py-2 px-3"></th>}
                </tr>
              </thead>
              <tbody>
                {editable
                  ? items.map((item, idx) => {
                      const base = parseFloat(item.quantity || "0") * parseFloat(item.unitPrice || "0");
                      const disc = base * (parseFloat(item.discountPercent || "0") / 100);
                      const afterDisc = base - disc;
                      const vat = afterDisc * parseFloat(item.vatRate || "0");
                      const lineTotal = afterDisc + vat;
                      return (
                        <tr key={item.tempId} className="border-t">
                          <td className="py-2 px-3 text-xs text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-sm">{item.productName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.productSku}</div>
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.tempId, "quantity", e.target.value)}
                              className="h-8 text-right w-20 ml-auto"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="w-28 ml-auto">
                              <CurrencyInput
                                value={item.unitPrice}
                                onChange={(v) => updateItem(item.tempId, "unitPrice", v)}
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={(e) => updateItem(item.tempId, "discountPercent", e.target.value)}
                              className="h-8 text-right w-16 ml-auto"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatVND(lineTotal)}
                          </td>
                          <td className="py-2 px-3">
                            <Button variant="ghost" size="icon" onClick={() => removeItem(item.tempId)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  : invoice.lineItems.map((li, idx) => (
                      <tr key={li.id} className="border-t">
                        <td className="py-2 px-3 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-sm">{li.product.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{li.product.sku}</div>
                        </td>
                        <td className="py-2 px-3 text-right">{Number(li.quantity).toLocaleString("vi-VN")}</td>
                        <td className="py-2 px-3 text-right">{formatVND(li.unitPrice)}</td>
                        <td className="py-2 px-3 text-right">{Number(li.discountPercent)}%</td>
                        <td className="py-2 px-3 text-right font-medium">{formatVND(li.lineTotal)}</td>
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
            {editable ? (
              <div>
                <Label>Chiết khấu tổng</Label>
                <CurrencyInput value={discountAmount} onChange={setDiscountAmount} />
              </div>
            ) : (
              <div />
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng tiền hàng:</span>
                <span className="font-medium">
                  {formatVND(editable ? subtotal : Number(invoice.subtotal))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chiết khấu:</span>
                <span className="font-medium">
                  {formatVND(editable ? parseFloat(discountAmount || "0") : Number(invoice.discountAmount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thuế GTGT:</span>
                <span className="font-medium">
                  {formatVND(editable ? vatAmount : Number(invoice.vatAmount))}
                </span>
              </div>
              {Number(invoice.shippingFee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phí ship:</span>
                  <span className="font-medium">
                    {formatVND(Number(invoice.shippingFee))}
                  </span>
                </div>
              )}
              <div className={cn("flex justify-between border-t pt-2")}>
                <span className="font-semibold">Tổng thanh toán:</span>
                <span className="font-bold text-xl text-primary">
                  {formatVND(editable ? total : Number(invoice.totalAmount))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Huỷ hoá đơn"
        message="Huỷ hoá đơn sẽ hoàn trả tồn kho. Hành động này không thể hoàn tác."
        itemCode={invoice.documentNumber}
        itemName={invoice.customer.name}
        confirmLabel="Huỷ phiếu"
        onConfirm={handleCancel}
      />
    </div>
  );
}
