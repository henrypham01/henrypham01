"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Folder,
  FolderOpen,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { parseApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
};

type CategoryNode = Category & {
  children: CategoryNode[];
  totalProducts: number; // self + descendants
};

function buildTree(items: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  for (const it of items) {
    map.set(it.id, { ...it, children: [], totalProducts: it._count.products });
  }
  const roots: CategoryNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort each level by name
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  // Compute recursive totals
  const totals = (node: CategoryNode): number => {
    node.totalProducts =
      node._count.products + node.children.reduce((s, c) => s + totals(c), 0);
    return node.totalProducts;
  };
  for (const r of roots) totals(r);
  return roots;
}

function filterTree(nodes: CategoryNode[], q: string): CategoryNode[] {
  if (!q) return nodes;
  const lower = q.toLowerCase();
  const walk = (node: CategoryNode): CategoryNode | null => {
    const matchedChildren = node.children
      .map(walk)
      .filter((c): c is CategoryNode => c !== null);
    const selfMatch =
      node.name.toLowerCase().includes(lower) ||
      node.code.toLowerCase().includes(lower);
    if (selfMatch || matchedChildren.length > 0) {
      return { ...node, children: matchedChildren };
    }
    return null;
  };
  return nodes
    .map(walk)
    .filter((n): n is CategoryNode => n !== null);
}

export default function CategoriesPage() {
  const t = useTranslations();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    nameEn: "",
    parentId: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const tree = useMemo(() => buildTree(categories), [categories]);
  const filtered = useMemo(() => filterTree(tree, search), [tree, search]);

  // Auto-expand all when searching
  useEffect(() => {
    if (search) {
      const ids = new Set<string>();
      const collect = (nodes: CategoryNode[]) => {
        for (const n of nodes) {
          if (n.children.length > 0) ids.add(n.id);
          collect(n.children);
        }
      };
      collect(filtered);
      setExpanded(ids);
    }
  }, [search, filtered]);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const openCreate = (parentId?: string) => {
    setEditingCategory(null);
    setForm({ code: "", name: "", nameEn: "", parentId: parentId || "" });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      code: cat.code,
      name: cat.name,
      nameEn: cat.nameEn || "",
      parentId: cat.parentId || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingCategory
      ? `/api/categories/${editingCategory.id}`
      : "/api/categories";
    const method = editingCategory ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        nameEn: form.nameEn || null,
        parentId: form.parentId || null,
      }),
    });

    if (!res.ok) {
      toast.error(await parseApiError(res, "Lưu thất bại"));
      return;
    }

    toast.success(t("categories.saveSuccess"));
    setDialogOpen(false);
    fetchCategories();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/categories/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("categories.deleteSuccess"));
      setDeleteTarget(null);
      fetchCategories();
    } else {
      toast.error(await parseApiError(res, "Xoá thất bại"));
    }
  };

  // Build indented option list for the searchable parent picker.
  // - Walks the tree so children appear under their parent (with "— " prefix
  //   per depth) — gives the user hierarchy context while searching.
  // - When editing, excludes the category itself and all of its descendants
  //   to prevent creating a cycle.
  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (editingCategory) {
      excluded.add(editingCategory.id);
      const collectDescendants = (parentId: string) => {
        for (const c of categories) {
          if (c.parentId === parentId) {
            excluded.add(c.id);
            collectDescendants(c.id);
          }
        }
      };
      collectDescendants(editingCategory.id);
    }

    const byParent = new Map<string | null, Category[]>();
    for (const c of categories) {
      if (excluded.has(c.id)) continue;
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    const out: { value: string; label: string }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      const list = byParent.get(parentId) || [];
      for (const c of list) {
        out.push({
          value: c.id,
          label: `${"— ".repeat(depth)}${c.name}`,
        });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [categories, editingCategory]);

  const renderNode = (
    node: CategoryNode,
    depth: number,
    isLast: boolean,
    ancestorLines: boolean[]
  ) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);

    // Visual depth: folders get a subtle colour based on level so top-level
    // groups are easy to scan while deeper levels recede.
    const folderTone =
      depth === 0
        ? "bg-primary/10 text-primary"
        : depth === 1
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
        : "bg-muted text-muted-foreground";

    return (
      <div key={node.id}>
        <div
          className={cn(
            "group relative flex items-center gap-2 rounded-md pr-2 py-1.5 transition-colors",
            "hover:bg-accent/60"
          )}
        >
          {/* Tree guide lines (vertical bars for each ancestor + L-bend to self) */}
          {depth > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 flex"
              aria-hidden
            >
              {ancestorLines.map((drawLine, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex w-5 items-stretch justify-center",
                    drawLine && "before:block before:w-px before:bg-border"
                  )}
                />
              ))}
              <span className="relative flex w-5 items-stretch justify-center">
                {/* Vertical segment that stops at the row centre for the last child */}
                <span
                  className={cn(
                    "block w-px bg-border",
                    isLast ? "h-1/2" : "h-full"
                  )}
                />
                {/* Horizontal arm */}
                <span className="absolute left-1/2 top-1/2 h-px w-3 bg-border" />
              </span>
            </div>
          )}

          {/* Left padding to match tree guides */}
          <div style={{ width: `${depth * 20 + 8}px` }} className="shrink-0" />

          {/* Expand / collapse chevron */}
          <button
            type="button"
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
              hasChildren
                ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                : "text-transparent"
            )}
            onClick={() => hasChildren && toggleExpand(node.id)}
            aria-label={isOpen ? "Thu gọn" : "Mở rộng"}
          >
            {hasChildren ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="h-1 w-1 rounded-full bg-border" />
            )}
          </button>

          {/* Folder icon */}
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              folderTone
            )}
          >
            {hasChildren ? (
              isOpen ? (
                <FolderOpen className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
          </span>

          {/* Name + meta */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium">{node.name}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                node.totalProducts > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
              title={`${node.totalProducts} sản phẩm`}
            >
              {node.totalProducts}
            </span>
            <span className="hidden shrink-0 rounded border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
              {node.code}
            </span>
          </div>

          {/* Row actions — appear on hover */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openCreate(node.id)}
              title="Thêm nhóm con"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openEdit(node)}
              title="Sửa"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-destructive/10"
              onClick={() => setDeleteTarget(node)}
              title="Xoá"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>

        {isOpen && hasChildren && (
          <div>
            {node.children.map((c, idx) =>
              renderNode(c, depth + 1, idx === node.children.length - 1, [
                ...ancestorLines,
                !isLast,
              ])
            )}
          </div>
        )}
      </div>
    );
  };

  // Flat counts for the header badge row
  const rootCount = tree.length;
  const totalWithProducts = categories.filter(
    (c) => c._count.products > 0
  ).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">
            {t("categories.title")}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Tổng:{" "}
              <span className="font-semibold text-foreground">
                {categories.length}
              </span>{" "}
              nhóm
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>
              <span className="font-semibold text-foreground">{rootCount}</span>{" "}
              nhóm gốc
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>
              <span className="font-semibold text-foreground">
                {totalWithProducts}
              </span>{" "}
              có sản phẩm
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Expand/collapse all */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (expanded.size > 0) {
                setExpanded(new Set());
              } else {
                const ids = new Set<string>();
                const walk = (nodes: CategoryNode[]) => {
                  for (const n of nodes) {
                    if (n.children.length > 0) ids.add(n.id);
                    walk(n.children);
                  }
                };
                walk(tree);
                setExpanded(ids);
              }
            }}
            className="gap-1.5"
            disabled={tree.length === 0}
          >
            {expanded.size > 0 ? (
              <>
                <ChevronRight className="h-4 w-4" />
                Thu gọn
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Mở rộng
              </>
            )}
          </Button>
          <Button onClick={() => openCreate()} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Tạo mới
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-3 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm nhóm hàng..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="min-h-[240px] rounded-xl border bg-card p-2 shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Folder className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {search ? "Không tìm thấy nhóm nào" : "Chưa có nhóm hàng nào"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Thử từ khoá khác hoặc xoá bộ lọc"
                  : "Tạo nhóm đầu tiên để bắt đầu phân loại sản phẩm"}
              </p>
            </div>
            {!search && (
              <Button
                size="sm"
                onClick={() => openCreate()}
                className="mt-1 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Tạo nhóm đầu tiên
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-transparent">
            {filtered.map((node, idx) =>
              renderNode(node, 0, idx === filtered.length - 1, [])
            )}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t("categories.editCategory")
                : t("categories.addCategory")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("categories.code")}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={!!editingCategory}
                  placeholder="VD: CSTOC"
                />
              </div>
              <div>
                <Label>{t("categories.nameEn")}</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t("categories.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Chăm sóc tóc"
              />
            </div>
            <div>
              <Label>{t("categories.parent")}</Label>
              <SearchableSelect
                options={parentOptions}
                value={form.parentId}
                onValueChange={(v) => setForm({ ...form, parentId: v })}
                placeholder={t("categories.noParent")}
                searchPlaceholder="Tìm nhóm cha..."
                emptyText="Không tìm thấy"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave}>{t("common.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("common.deleteConfirmTitle")}
        message={
          deleteTarget && deleteTarget._count.children > 0
            ? `Nhóm này có ${deleteTarget._count.children} nhóm con. Vui lòng xoá nhóm con trước.`
            : t("common.deleteConfirmMessage")
        }
        itemName={deleteTarget?.name}
        itemCode={deleteTarget?.code}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
