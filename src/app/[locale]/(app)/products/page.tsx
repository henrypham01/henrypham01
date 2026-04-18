"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Pencil,
  Trash2,
  ImageIcon,
  Star,
  Search,
  Filter,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { formatVND } from "@/lib/formatting";
import { CurrencyInput } from "@/components/shared/currency-input";
import { ImageUpload } from "@/components/shared/image-upload";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  nameEn: string | null;
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

type Unit = { id: string; code: string; name: string };
type Category = { id: string; code: string; name: string; parentId: string | null };
type Supplier = { id: string; name: string };
type Brand = { id: string; name: string };

const emptyForm = {
  sku: "",
  barcode: "",
  name: "",
  nameEn: "",
  description: "",
  categoryId: "",
  baseUnitId: "",
  supplierId: "",
  brandId: "",
  costPrice: "0",
  sellingPrice: "0",
  vatRate: "0.10",
  minStock: "0",
  maxStock: "999999999",
  origin: "",
  imageUrl: "" as string | null,
  initialStock: "0",
  batchNumber: "",
  manufacturingDate: "",
  expiryDate: "",
  registrationNumber: "",
  usageFunction: "",
};

export default function ProductsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const editIdFromQuery = searchParams.get("edit");
  const handledEditIdRef = useRef<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "description">("info");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStockStatus, setFilterStockStatus] = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterExpiring, setFilterExpiring] = useState("");
  const [filterUsageFunction, setFilterUsageFunction] = useState("");
  const [usageFunctions, setUsageFunctions] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (filterStockStatus) params.set("stockStatus", filterStockStatus);
    if (filterSupplierId) params.set("supplierId", filterSupplierId);
    if (filterBrandId) params.set("brandId", filterBrandId);
    if (filterExpiring) params.set("expiring", filterExpiring);
    if (filterUsageFunction) params.set("usageFunction", filterUsageFunction);
    const res = await fetch(`/api/products?${params.toString()}`);
    setProducts(await res.json());
  }, [debouncedSearch, filterCategoryId, filterStockStatus, filterSupplierId, filterBrandId, filterExpiring, filterUsageFunction]);

  const fetchRefs = useCallback(async () => {
    const [unitsRes, catsRes, supRes, brRes, ufRes] = await Promise.all([
      fetch("/api/units"),
      fetch("/api/categories"),
      fetch("/api/suppliers"),
      fetch("/api/brands"),
      fetch("/api/products/usage-functions"),
    ]);
    setUnits(await unitsRes.json());
    setCategories(await catsRes.json());
    setSuppliers(await supRes.json());
    setBrands(await brRes.json());
    setUsageFunctions(await ufRes.json());
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  const totalStock = useMemo(
    () => products.reduce((s, p) => s + parseFloat(p.currentStock), 0),
    [products]
  );

  // Flatten category tree into indented options: parents first, then children
  const categoryOptions = useMemo(() => {
    const byParent = new Map<string | null, Category[]>();
    for (const c of categories) {
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }
    const out: { value: string; label: string }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const items = byParent.get(parentId) || [];
      for (const c of items) {
        out.push({
          value: c.id,
          label: `${"— ".repeat(depth)}${c.name}`,
        });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [categories]);

  const allOnPageSelected =
    products.length > 0 && products.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openCreate = async () => {
    setEditingProduct(null);
    setActiveTab("info");
    // Auto-fetch next code
    try {
      const res = await fetch("/api/products/next-code");
      const data = await res.json();
      setForm({ ...emptyForm, sku: data.code });
    } catch {
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const openEdit = useCallback((p: Product) => {
    setEditingProduct(p);
    setActiveTab("info");
    setForm({
      sku: p.sku,
      barcode: p.barcode || "",
      name: p.name,
      nameEn: p.nameEn || "",
      description: "",
      categoryId: p.categoryId || "",
      baseUnitId: p.baseUnitId,
      supplierId: p.supplierId || "",
      brandId: p.brandId || "",
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      vatRate: p.vatRate,
      minStock: p.minStock,
      maxStock: p.maxStock,
      origin: p.origin || "",
      imageUrl: p.imageUrl || "",
      initialStock: p.currentStock,
      batchNumber: p.batchNumber || "",
      manufacturingDate: p.manufacturingDate
        ? p.manufacturingDate.slice(0, 10)
        : "",
      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : "",
      registrationNumber: p.registrationNumber || "",
      usageFunction: p.usageFunction || "",
    });
    setDialogOpen(true);
  }, []);

  // Support deep-link edit: navigate here with ?edit=<id> (e.g. from the
  // product detail page's "Sửa" button) and the edit dialog auto-opens.
  // Fetches the product directly so it still works when the current list is
  // filtered and the target isn't present.
  //
  // Note: we deliberately DON'T use a `cancelled` cleanup flag — React's
  // StrictMode double-invokes effects (with a cleanup between them), which
  // would cancel the first fetch before it resolves. The `handledEditIdRef`
  // guard de-duplicates the fetch across those two runs instead.
  useEffect(() => {
    if (!editIdFromQuery) return;
    if (handledEditIdRef.current === editIdFromQuery) return;
    handledEditIdRef.current = editIdFromQuery;

    (async () => {
      try {
        const res = await fetch(`/api/products/${editIdFromQuery}`);
        if (!res.ok) {
          toast.error(t("common.error"));
          return;
        }
        const p: Product = await res.json();
        openEdit(p);
      } catch {
        toast.error(t("common.error"));
      } finally {
        // Strip ?edit from the URL so refresh/back doesn't reopen the dialog.
        const next = new URLSearchParams(searchParams.toString());
        next.delete("edit");
        const q = next.toString();
        router.replace(`/${locale}/products${q ? `?${q}` : ""}`);
      }
    })();
  }, [editIdFromQuery, openEdit, router, locale, searchParams, t]);

  const handleSave = async (keepOpen = false) => {
    // Cảnh báo nếu giá vốn > giá bán
    const cost = parseFloat(form.costPrice);
    const sell = parseFloat(form.sellingPrice);
    if (cost > sell && sell > 0) {
      const ok = confirm("Giá vốn lớn hơn giá bán (bán lỗ). Tiếp tục lưu?");
      if (!ok) return;
    }

    const url = editingProduct
      ? `/api/products/${editingProduct.id}`
      : "/api/products";
    const method = editingProduct ? "PUT" : "POST";

    // Strip `initialStock` on edit — stock changes only via nhập/xuất, and
    // the server only honours initialStock on create anyway.
    const { initialStock: formInitial, ...formRest } = form;
    const initialStock = editingProduct ? undefined : formInitial;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formRest,
        barcode: formRest.barcode || null,
        categoryId: formRest.categoryId || null,
        supplierId: formRest.supplierId || null,
        brandId: formRest.brandId || null,
        nameEn: formRest.nameEn || null,
        description: formRest.description || null,
        origin: formRest.origin || null,
        imageUrl: formRest.imageUrl || null,
        batchNumber: formRest.batchNumber || null,
        manufacturingDate: formRest.manufacturingDate || null,
        expiryDate: formRest.expiryDate || null,
        registrationNumber: formRest.registrationNumber || null,
        usageFunction: formRest.usageFunction || null,
        ...(initialStock !== undefined && initialStock !== "" && {
          initialStock: parseFloat(initialStock) || 0,
          // Use the cost price as initial cost — UX: 1 field for cost basis
          initialCost: parseFloat(formRest.costPrice) || 0,
        }),
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

    toast.success(editingProduct ? "Cập nhật thành công" : "Tạo hàng hoá thành công");
    fetchProducts();
    if (keepOpen && !editingProduct) {
      // Reset form, keep dialog open for next item
      try {
        const ncRes = await fetch("/api/products/next-code");
        const nc = await ncRes.json();
        setForm({ ...emptyForm, sku: nc.code });
      } catch {
        setForm(emptyForm);
      }
      setActiveTab("info");
    } else {
      setDialogOpen(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/products/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("common.success"));
      setDeleteTarget(null);
      fetchProducts();
    } else {
      toast.error(t("common.error"));
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch(`/api/products`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      toast.success(t("common.success"));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchProducts();
    } else {
      toast.error(t("common.error"));
    }
  };

  const handleStar = async (id: string) => {
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isStarred: !p.isStarred } : p))
    );
    const res = await fetch(`/api/products/${id}/star`, { method: "PATCH" });
    if (!res.ok) {
      // rollback
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isStarred: !p.isStarred } : p))
      );
      toast.error("Không thể cập nhật");
    }
  };

  const clearFilters = () => {
    setFilterCategoryId("");
    setFilterStockStatus("");
    setFilterSupplierId("");
    setFilterBrandId("");
    setFilterExpiring("");
    setFilterUsageFunction("");
  };

  const hasActiveFilters =
    filterCategoryId ||
    filterStockStatus ||
    filterSupplierId ||
    filterBrandId ||
    filterExpiring ||
    filterUsageFunction;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">{t("products.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tổng tồn kho: <span className="font-semibold text-foreground">{totalStock.toLocaleString("vi-VN")}</span>
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          {t("products.addProduct")}
        </Button>
      </div>

      {/* Toolbar: search + filter */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Theo mã, tên hàng"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant={filterOpen || hasActiveFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterOpen(!filterOpen)}
          className="gap-1.5"
        >
          <Filter className="h-4 w-4" />
          Bộ lọc
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-primary-foreground text-primary text-[10px] px-1.5 py-0.5 font-bold">
              {[filterCategoryId, filterStockStatus, filterSupplierId, filterBrandId, filterExpiring, filterUsageFunction].filter(Boolean).length}
            </span>
          )}
        </Button>
        {selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 shadow-sm">
            <span className="text-xs text-muted-foreground">Đã chọn {selectedIds.size}</span>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              className="h-7 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xoá
            </Button>
          </div>
        )}
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <Label className="text-xs">Nhóm hàng</Label>
            <SearchableSelect
              options={categoryOptions}
              value={filterCategoryId}
              onValueChange={setFilterCategoryId}
              placeholder="Tất cả"
              searchPlaceholder="Tìm nhóm hàng..."
              emptyText="Không tìm thấy"
            />
          </div>
          <div>
            <Label className="text-xs">Tồn kho</Label>
            <Select value={filterStockStatus || "all"} onValueChange={(v) => setFilterStockStatus(!v || v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue>
                  {filterStockStatus === "inStock" ? "Còn hàng" :
                   filterStockStatus === "outOfStock" ? "Hết hàng" :
                   filterStockStatus === "belowMin" ? "Dưới định mức" : "Tất cả"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="inStock">Còn hàng</SelectItem>
                <SelectItem value="outOfStock">Hết hàng</SelectItem>
                <SelectItem value="belowMin">Dưới định mức</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nhà cung cấp</Label>
            <SearchableSelect
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              value={filterSupplierId}
              onValueChange={setFilterSupplierId}
              placeholder="Tất cả"
              searchPlaceholder="Tìm nhà cung cấp..."
              emptyText="Không tìm thấy"
            />
          </div>
          <div>
            <Label className="text-xs">Thương hiệu</Label>
            <Select value={filterBrandId || "all"} onValueChange={(v) => setFilterBrandId(!v || v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue>
                  {filterBrandId ? brands.find((b) => b.id === filterBrandId)?.name || "Tất cả" : "Tất cả"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Sắp hết hạn</Label>
            <Select value={filterExpiring || "all"} onValueChange={(v) => setFilterExpiring(!v || v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue>
                  {filterExpiring === "30" ? "Trong 30 ngày" :
                   filterExpiring === "60" ? "Trong 60 ngày" :
                   filterExpiring === "90" ? "Trong 90 ngày" : "Tất cả"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="30">Trong 30 ngày</SelectItem>
                <SelectItem value="60">Trong 60 ngày</SelectItem>
                <SelectItem value="90">Trong 90 ngày</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Công dụng</Label>
            <Select value={filterUsageFunction || "all"} onValueChange={(v) => setFilterUsageFunction(!v || v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue>
                  {filterUsageFunction || "Tất cả"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {usageFunctions.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <div className="col-span-full">
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 h-7">
                <X className="h-3.5 w-3.5" />
                Xoá bộ lọc
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 py-3 px-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-input"
                />
              </th>
              <th className="w-10 py-3 px-2"></th>
              <th className="w-14 py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ảnh</th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã hàng</th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên hàng</th>
              <th className="py-3 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giá bán</th>
              <th className="py-3 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giá vốn</th>
              <th className="py-3 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tồn kho</th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">HSD</th>
              <th className="py-3 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày tạo</th>
              <th className="py-3 px-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center text-muted-foreground py-10">
                  {t("common.noData")}
                </td>
              </tr>
            ) : (
              products.map((p, i) => {
                const stock = parseFloat(p.currentStock);
                const min = parseFloat(p.minStock);
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t cursor-pointer hover:bg-accent/50 transition-colors",
                      i % 2 === 1 && !isSelected && "bg-muted/20",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => router.push(`/${locale}/products/${p.id}`)}
                  >
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-input"
                      />
                    </td>
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleStar(p.id)}
                        className="p-1 rounded hover:bg-accent"
                        title={p.isStarred ? "Bỏ đánh dấu" : "Đánh dấu"}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            p.isStarred
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="40px" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-xs">{p.sku}</td>
                    <td className="py-2.5 px-2 font-medium">
                      {p.name}
                    </td>
                    <td className="py-2.5 px-2 text-right">{formatVND(p.sellingPrice)}</td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground">{formatVND(p.costPrice)}</td>
                    <td className="py-2.5 px-2 text-right">
                      <span className={cn(stock < min && min > 0 && "text-destructive font-medium")}>
                        {stock.toLocaleString("vi-VN")}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-xs">
                      {p.expiryDate ? (() => {
                        const daysLeft = differenceInDays(new Date(p.expiryDate), new Date());
                        const className = daysLeft < 0
                          ? "text-destructive font-semibold"
                          : daysLeft <= 30
                          ? "text-orange-600 font-medium"
                          : "text-muted-foreground";
                        return (
                          <span className={className}>
                            {format(new Date(p.expiryDate), "dd/MM/yyyy")}
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">
                      {format(new Date(p.createdAt), "dd/MM/yyyy")}
                    </td>
                    <td className="py-2.5 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog form — KiotViet-style */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-lg">
              {editingProduct ? "Cập nhật hàng hoá" : "Tạo hàng hoá"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "description")}>
            <TabsList className="mx-6 mt-3">
              <TabsTrigger value="info">Thông tin</TabsTrigger>
              <TabsTrigger value="description">Mô tả</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="px-6 py-4 space-y-4 m-0">
              {/* Top row: basic fields + image */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Mã hàng</Label>
                      <Input
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        placeholder="Tự động"
                      />
                    </div>
                    <div>
                      <Label>Mã vạch</Label>
                      <Input
                        value={form.barcode}
                        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                        placeholder="Nhập mã vạch"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Tên hàng *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Bắt buộc"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nhóm hàng</Label>
                      <SearchableSelect
                        options={categoryOptions}
                        value={form.categoryId}
                        onValueChange={(v) => setForm({ ...form, categoryId: v })}
                        placeholder="Chọn nhóm hàng"
                        searchPlaceholder="Tìm nhóm hàng..."
                        emptyText="Không tìm thấy"
                      />
                    </div>
                    <div>
                      <Label>Thương hiệu</Label>
                      <SearchableSelect
                        options={brands.map((b) => ({ value: b.id, label: b.name }))}
                        value={form.brandId}
                        onValueChange={(v) => setForm({ ...form, brandId: v })}
                        placeholder="Chọn thương hiệu"
                        searchPlaceholder="Tìm thương hiệu..."
                        emptyText="Không tìm thấy"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Đơn vị tính *</Label>
                      <SearchableSelect
                        options={units.map((u) => ({ value: u.id, label: u.name }))}
                        value={form.baseUnitId}
                        onValueChange={(v) => setForm({ ...form, baseUnitId: v })}
                        placeholder="Chọn đơn vị"
                        searchPlaceholder="Tìm đơn vị..."
                        emptyText="Không tìm thấy"
                      />
                    </div>
                    <div>
                      <Label>Nhà cung cấp</Label>
                      <SearchableSelect
                        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                        value={form.supplierId}
                        onValueChange={(v) => setForm({ ...form, supplierId: v })}
                        placeholder="- Chọn nhà cung cấp -"
                        searchPlaceholder="Tìm nhà cung cấp..."
                        emptyText="Không tìm thấy"
                      />
                    </div>
                  </div>
                </div>

                {/* Image uploader on right */}
                <div>
                  <Label className="mb-1.5 block">Hình ảnh</Label>
                  <ImageUpload
                    value={form.imageUrl || null}
                    onChange={(url) => setForm({ ...form, imageUrl: url || "" })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Mỗi ảnh không quá 2 MB
                  </p>
                </div>
              </div>

              {/* Giá vốn, giá bán section */}
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-semibold block mb-2">Giá vốn, giá bán</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Giá vốn</Label>
                    <CurrencyInput
                      value={form.costPrice}
                      onChange={(v) => setForm({ ...form, costPrice: v })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Giá bán *</Label>
                    <CurrencyInput
                      value={form.sellingPrice}
                      onChange={(v) => setForm({ ...form, sellingPrice: v })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Thuế GTGT (%)</Label>
                    {/*
                      UX: user types the percentage directly (e.g. "10" = 10%).
                      Storage is still the decimal fraction (0.10) to satisfy
                      the Zod validator `vatRate.min(0).max(1)` on the API.
                    */}
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0"
                      value={
                        form.vatRate === ""
                          ? ""
                          : String(
                              Number(
                                (parseFloat(form.vatRate) * 100).toFixed(4)
                              )
                            )
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setForm({ ...form, vatRate: "0" });
                          return;
                        }
                        const pct = Math.max(0, Math.min(100, parseFloat(raw)));
                        if (isNaN(pct)) return;
                        setForm({ ...form, vatRate: String(pct / 100) });
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Tồn kho section */}
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-semibold block mb-1">Tồn kho</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Quản lý số lượng tồn kho và định mức tồn. Khi tồn kho chạm định mức, sẽ nhận được cảnh báo.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Tồn ban đầu</Label>
                    {editingProduct ? (
                      <>
                        <Input
                          type="number"
                          value={form.initialStock || "0"}
                          disabled
                          className="bg-muted/40"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Chỉ sửa qua phiếu nhập / xuất
                        </p>
                      </>
                    ) : (
                      <>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={form.initialStock}
                          onChange={(e) =>
                            setForm({ ...form, initialStock: e.target.value })
                          }
                          placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Dùng giá vốn làm giá nhập ban đầu
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Định mức tồn thấp nhất</Label>
                    <Input
                      type="number"
                      value={form.minStock}
                      onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Định mức tồn cao nhất</Label>
                    <Input
                      type="number"
                      value={form.maxStock}
                      onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Xuất xứ */}
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-semibold block mb-2">Thông tin khác</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Xuất xứ</Label>
                    <Input
                      value={form.origin}
                      onChange={(e) => setForm({ ...form, origin: e.target.value })}
                      placeholder="VD: Pháp, Hàn Quốc"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tên tiếng Anh</Label>
                    <Input
                      value={form.nameEn}
                      onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Mỹ phẩm / TPCN section */}
              <div className="rounded-lg border p-4">
                <Label className="text-sm font-semibold block mb-2">
                  Thông tin mỹ phẩm / TPCN
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Số lô</Label>
                    <Input
                      value={form.batchNumber}
                      onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                      placeholder="VD: L2024001"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Số đăng ký</Label>
                    <Input
                      value={form.registrationNumber}
                      onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                      placeholder="Số đăng ký lưu hành"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ngày sản xuất</Label>
                    <Input
                      type="date"
                      value={form.manufacturingDate}
                      onChange={(e) => setForm({ ...form, manufacturingDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hạn sử dụng</Label>
                    <Input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Công dụng</Label>
                    <Input
                      value={form.usageFunction}
                      onChange={(e) => setForm({ ...form, usageFunction: e.target.value })}
                      placeholder="VD: Dưỡng da, chống lão hoá, bổ sung vitamin..."
                      list="usage-functions-list"
                    />
                    <datalist id="usage-functions-list">
                      {usageFunctions.map((uf) => (
                        <option key={uf} value={uf} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="description" className="px-6 py-4 m-0">
              <Label className="text-sm">Mô tả chi tiết sản phẩm</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={14}
                placeholder="Nhập mô tả chi tiết về sản phẩm, thành phần, hướng dẫn sử dụng..."
                className="mt-2"
              />
            </TabsContent>
          </Tabs>

          {/* Sticky footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t bg-card sticky bottom-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Bỏ qua
            </Button>
            {!editingProduct && (
              <Button variant="secondary" onClick={() => handleSave(true)}>
                Lưu & Tạo thêm
              </Button>
            )}
            <Button onClick={() => handleSave(false)}>Lưu</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("common.deleteConfirmTitle")}
        message={t("common.deleteConfirmMessage")}
        itemName={deleteTarget?.name}
        itemCode={deleteTarget?.sku}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t("common.deleteConfirmTitle")}
        message={`Xoá ${selectedIds.size} hàng hoá đã chọn? Hành động này không thể hoàn tác.`}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
