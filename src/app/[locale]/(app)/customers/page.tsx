"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

type Customer = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  paymentTermDays: number;
  creditLimit: string;
  discountPercent: string;
  isActive: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  taxId: "",
  address: "",
  city: "",
  region: "",
  paymentTermDays: "30",
  creditLimit: "0",
  discountPercent: "0",
};

export default function CustomersPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const editIdFromQuery = searchParams.get("edit");
  const handledEditIdRef = useRef<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = useCallback((c: Customer) => {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      contactPerson: c.contactPerson || "",
      phone: c.phone || "",
      email: c.email || "",
      taxId: c.taxId || "",
      address: c.address || "",
      city: c.city || "",
      region: c.region || "",
      paymentTermDays: String(c.paymentTermDays),
      creditLimit: c.creditLimit,
      discountPercent: c.discountPercent,
    });
    setDialogOpen(true);
  }, []);

  // Deep-link edit: navigate here with ?edit=<id> (e.g. from the customer
  // detail page's "Sửa" button). Mirror the products page pattern.
  useEffect(() => {
    if (!editIdFromQuery) return;
    if (handledEditIdRef.current === editIdFromQuery) return;
    handledEditIdRef.current = editIdFromQuery;

    (async () => {
      try {
        const res = await fetch(`/api/customers/${editIdFromQuery}`);
        if (!res.ok) {
          toast.error(t("common.error"));
          return;
        }
        const c: Customer = await res.json();
        openEdit(c);
      } catch {
        toast.error(t("common.error"));
      } finally {
        const next = new URLSearchParams(searchParams.toString());
        next.delete("edit");
        const q = next.toString();
        router.replace(`/${locale}/customers${q ? `?${q}` : ""}`);
      }
    })();
  }, [editIdFromQuery, openEdit, router, locale, searchParams, t]);

  const handleSave = async () => {
    const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        contactPerson: form.contactPerson || null,
        phone: form.phone || null,
        email: form.email || null,
        taxId: form.taxId || null,
        address: form.address || null,
        city: form.city || null,
        region: form.region || null,
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

    toast.success(t("common.success"));
    setDialogOpen(false);
    fetchCustomers();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/customers/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("common.success"));
      setDeleteTarget(null);
      fetchCustomers();
    } else {
      toast.error(t("common.error"));
    }
  };

  const columns: ColumnDef<Customer>[] = [
    { accessorKey: "code", header: t("customers.code") },
    { accessorKey: "name", header: t("customers.name") },
    { accessorKey: "phone", header: t("customers.phone") },
    {
      id: "address",
      header: t("customers.address"),
      cell: ({ row }) => {
        const parts = [
          row.original.address,
          row.original.city,
          row.original.region,
        ].filter(Boolean);
        const full = parts.join(", ");
        return full ? (
          <span className="block max-w-[320px] truncate" title={full}>
            {full}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "paymentTerm",
      header: t("customers.paymentTermDays"),
      cell: ({ row }) => `${row.original.paymentTermDays} days`,
    },
    {
      id: "actions",
      header: t("common.actions"),
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(row.original)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("customers.title")}
        actionLabel={t("customers.addCustomer")}
        onAction={openCreate}
      />
      <DataTable
        columns={columns}
        data={customers}
        onRowClick={(c) => router.push(`/${locale}/customers/${c.id}`)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("customers.editCustomer") : t("customers.addCustomer")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("customers.code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={!!editing}
              />
            </div>
            <div>
              <Label>{t("customers.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.contactPerson")}</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.taxId")}</Label>
              <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <Label>{t("customers.address")}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.city")}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.region")}</Label>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.paymentTermDays")}</Label>
              <Input type="number" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })} />
            </div>
            <div>
              <Label>{t("customers.discountPercent")}</Label>
              <Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
            </div>
            <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
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
        itemCode={deleteTarget?.code}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
