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

type Unit = {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
};

export default function UnitsPage() {
  const t = useTranslations();
  const [units, setUnits] = useState<Unit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState({ code: "", name: "", nameEn: "" });
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  const fetchUnits = useCallback(async () => {
    const res = await fetch("/api/units");
    const data = await res.json();
    setUnits(data);
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const openCreate = () => {
    setEditingUnit(null);
    setForm({ code: "", name: "", nameEn: "" });
    setDialogOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setForm({ code: unit.code, name: unit.name, nameEn: unit.nameEn || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingUnit ? `/api/units/${editingUnit.id}` : "/api/units";
    const method = editingUnit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        nameEn: form.nameEn || null,
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

    toast.success(t("units.saveSuccess"));
    setDialogOpen(false);
    fetchUnits();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/units/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(t("units.deleteSuccess"));
      setDeleteTarget(null);
      fetchUnits();
    } else {
      toast.error(t("common.error"));
    }
  };

  const columns: ColumnDef<Unit>[] = [
    { accessorKey: "code", header: t("units.code") },
    { accessorKey: "name", header: t("units.name") },
    { accessorKey: "nameEn", header: t("units.nameEn") },
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
        title={t("units.title")}
        actionLabel={t("units.addUnit")}
        onAction={openCreate}
      />
      <DataTable columns={columns} data={units} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? t("units.editUnit") : t("units.addUnit")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("units.code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={!!editingUnit}
              />
            </div>
            <div>
              <Label>{t("units.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("units.nameEn")}</Label>
              <Input
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
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
        itemCode={deleteTarget?.code}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
