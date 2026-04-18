"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type Brand = {
  id: string;
  name: string;
};

export default function BrandsPage() {
  const t = useTranslations();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "" });
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);

  const fetchBrands = useCallback(async () => {
    const res = await fetch("/api/brands");
    const data = await res.json();
    setBrands(data);
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const openCreate = () => {
    setEditingBrand(null);
    setForm({ name: "" });
    setDialogOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setForm({ name: brand.name });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("brands.nameRequired"));
      return;
    }

    const url = editingBrand ? `/api/brands/${editingBrand.id}` : "/api/brands";
    const method = editingBrand ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name }),
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

    toast.success(t("brands.saveSuccess"));
    setDialogOpen(false);
    fetchBrands();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/brands/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("brands.deleteSuccess"));
      setDeleteTarget(null);
      fetchBrands();
    } else {
      toast.error(t("common.error"));
    }
  };

  const columns: ColumnDef<Brand>[] = [
    { accessorKey: "name", header: t("brands.name") },
    {
      id: "actions",
      header: t("common.actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row.original)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("brands.title")}
        actionLabel={t("brands.addBrand")}
        onAction={openCreate}
      />
      <DataTable columns={columns} data={brands} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? t("brands.editBrand") : t("brands.addBrand")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("brands.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
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
        message={t("common.deleteConfirmMessage")}
        itemName={deleteTarget?.name}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
