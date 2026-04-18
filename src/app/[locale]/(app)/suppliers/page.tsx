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
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, ChevronDown } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Supplier = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  ward: string | null;
  notes: string | null;
  companyName: string | null;
  taxId: string | null;
  isActive: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  ward: "",
  notes: "",
  companyName: "",
  taxId: "",
};

type FormState = typeof emptyForm;

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function SuppliersPage() {
  const t = useTranslations();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    const res = await fetch("/api/suppliers");
    const data = await res.json();
    setSuppliers(data);
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const openCreate = async () => {
    setEditingSupplier(null);
    // Auto-fetch next code
    try {
      const res = await fetch("/api/suppliers/next-code");
      const data = await res.json();
      setForm({ ...emptyForm, code: data.code });
    } catch {
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      code: supplier.code || "",
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      ward: supplier.ward || "",
      notes: supplier.notes || "",
      companyName: supplier.companyName || "",
      taxId: supplier.taxId || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("suppliers.nameRequired"));
      return;
    }

    const url = editingSupplier
      ? `/api/suppliers/${editingSupplier.id}`
      : "/api/suppliers";
    const method = editingSupplier ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code || null,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        ward: form.ward || null,
        notes: form.notes || null,
        companyName: form.companyName || null,
        taxId: form.taxId || null,
        groupId: null,
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

    toast.success(t("suppliers.saveSuccess"));
    setDialogOpen(false);
    fetchSuppliers();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/suppliers/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("suppliers.deleteSuccess"));
      setDeleteTarget(null);
      fetchSuppliers();
    } else {
      toast.error(t("common.error"));
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "code",
      header: t("suppliers.code"),
      cell: ({ row }) => row.original.code || "-",
    },
    { accessorKey: "name", header: t("suppliers.name") },
    {
      accessorKey: "phone",
      header: t("suppliers.phone"),
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "email",
      header: t("suppliers.email"),
      cell: ({ row }) => row.original.email || "-",
    },
    {
      accessorKey: "address",
      header: t("suppliers.address"),
      cell: ({ row }) => row.original.address || "-",
    },
    {
      accessorKey: "taxId",
      header: t("suppliers.taxId"),
      cell: ({ row }) => row.original.taxId || "-",
    },
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
        title={t("suppliers.title")}
        actionLabel={t("suppliers.addSupplier")}
        onAction={openCreate}
      />
      <DataTable columns={columns} data={suppliers} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier
                ? t("suppliers.editSupplier")
                : t("suppliers.createSupplier")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Top: basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("suppliers.name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("suppliers.namePlaceholder")}
                  autoFocus
                />
              </div>
              <div>
                <Label>{t("suppliers.code")}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder={t("suppliers.codePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("suppliers.phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("suppliers.email")}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@gmail.com"
                />
              </div>
            </div>

            {/* Section: Địa chỉ */}
            <Section title={t("suppliers.addressSection")}>
              <div>
                <Label>{t("suppliers.address")}</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder={t("suppliers.addressPlaceholder")}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("suppliers.city")}</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder={t("suppliers.cityPlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("suppliers.ward")}</Label>
                  <Input
                    value={form.ward}
                    onChange={(e) => setForm({ ...form, ward: e.target.value })}
                    placeholder={t("suppliers.wardPlaceholder")}
                  />
                </div>
              </div>
            </Section>

            {/* Section: Ghi chú */}
            <Section title={t("suppliers.notes")}>
              <div>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  placeholder={t("suppliers.notesPlaceholder")}
                  rows={3}
                />
              </div>
            </Section>

            {/* Section: Thông tin xuất hóa đơn */}
            <Section title={t("suppliers.invoiceInfoSection")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("suppliers.companyName")}</Label>
                  <Input
                    value={form.companyName}
                    onChange={(e) =>
                      setForm({ ...form, companyName: e.target.value })
                    }
                    placeholder={t("suppliers.companyNamePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("suppliers.taxId")}</Label>
                  <Input
                    value={form.taxId}
                    onChange={(e) =>
                      setForm({ ...form, taxId: e.target.value })
                    }
                    placeholder={t("suppliers.taxIdPlaceholder")}
                  />
                </div>
              </div>
            </Section>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.skip")}
              </Button>
              <Button onClick={handleSave}>{t("common.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("suppliers.deleteConfirmTitle")}
        message={t("suppliers.deleteConfirmMessage")}
        itemName={deleteTarget?.name}
        itemCode={deleteTarget?.code || undefined}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
