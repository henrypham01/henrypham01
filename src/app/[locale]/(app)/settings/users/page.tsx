"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, KeyRound, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { parseApiError } from "@/lib/api-error";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
};

type User = {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  roleId: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: Role;
};

const emptyForm = {
  username: "",
  password: "",
  fullName: "",
  phone: "",
  roleId: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const fetchData = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/roles"),
    ]);
    setUsers(await uRes.json());
    setRoles(await rRes.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setForm({ ...emptyForm, roleId: roles.find((r) => r.name !== "Chủ cửa hàng")?.id || "" });
    setCreateOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: "",
      fullName: u.fullName,
      phone: u.phone || "",
      roleId: u.roleId,
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      toast.error(await parseApiError(res, "Tạo tài khoản thất bại"));
      return;
    }
    toast.success("Tạo tài khoản thành công");
    setCreateOpen(false);
    fetchData();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        phone: form.phone || null,
        roleId: form.roleId,
      }),
    });
    if (!res.ok) {
      toast.error(await parseApiError(res, "Cập nhật thất bại"));
      return;
    }
    toast.success("Cập nhật thành công");
    setEditOpen(false);
    fetchData();
  };

  const handleToggleActive = async (u: User) => {
    const res = await fetch(`/api/users/${u.id}/toggle-active`, {
      method: "PATCH",
    });
    if (!res.ok) {
      toast.error(await parseApiError(res));
      return;
    }
    toast.success(u.isActive ? "Đã khoá tài khoản" : "Đã mở khoá tài khoản");
    fetchData();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/users/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error(await parseApiError(res, "Xoá thất bại"));
      return;
    }
    toast.success("Đã xoá");
    setDeleteTarget(null);
    fetchData();
  };

  const openReset = (u: User) => {
    setResetUser(u);
    setNewPassword("");
    setResetOpen(true);
  };

  const handleReset = async () => {
    if (!resetUser || newPassword.length < 6) {
      toast.error("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    const res = await fetch(`/api/users/${resetUser.id}/reset-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      toast.error("Lỗi");
      return;
    }
    toast.success("Đã đặt lại mật khẩu");
    setResetOpen(false);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight">Quản lý tài khoản</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tổng: <span className="font-semibold text-foreground">{users.length}</span> tài khoản
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên đăng nhập</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Họ tên</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">SĐT</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vai trò</th>
              <th className="py-3 px-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trạng thái</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đăng nhập gần nhất</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-10">
                  Chưa có tài khoản nào
                </td>
              </tr>
            ) : (
              users.map((u, i) => {
                const isOwner = u.role.name === "Chủ cửa hàng";
                return (
                  <tr key={u.id} className={cn("border-t", i % 2 === 1 && "bg-muted/20")}>
                    <td className="py-2.5 px-3 font-mono text-xs font-medium">{u.username}</td>
                    <td className="py-2.5 px-3 font-medium">{u.fullName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{u.phone || "-"}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant={isOwner ? "default" : "outline"}>{u.role.name}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {u.isActive ? (
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                          Hoạt động
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Đã khoá</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {u.lastLoginAt
                        ? format(new Date(u.lastLoginAt), "dd/MM/yyyy HH:mm")
                        : "Chưa đăng nhập"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(u)}
                          title="Sửa"
                          disabled={isOwner}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openReset(u)}
                          title="Đặt lại mật khẩu"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {!isOwner && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(u)}
                              title={u.isActive ? "Khoá" : "Mở khoá"}
                            >
                              {u.isActive ? (
                                <Lock className="h-4 w-4 text-orange-600" />
                              ) : (
                                <Unlock className="h-4 w-4 text-emerald-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(u)}
                              title="Xoá"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo tài khoản nhân viên</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Họ tên *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Tên đăng nhập *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="min 4 ký tự, không dấu"
              />
            </div>
            <div>
              <Label>Mật khẩu *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="min 6 ký tự"
              />
            </div>
            <div>
              <Label>Vai trò *</Label>
              <Select
                value={form.roleId || ""}
                onValueChange={(v) => v && setForm({ ...form, roleId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="- Chọn vai trò -">
                    {form.roleId ? roles.find((r) => r.id === form.roleId)?.name : "- Chọn vai trò -"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((r) => r.name !== "Chủ cửa hàng")
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleCreate}>Tạo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa tài khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên đăng nhập</Label>
              <Input value={form.username} disabled />
            </div>
            <div>
              <Label>Họ tên *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Vai trò *</Label>
              <Select
                value={form.roleId || ""}
                onValueChange={(v) => v && setForm({ ...form, roleId: v })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {form.roleId ? roles.find((r) => r.id === form.roleId)?.name : "-"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((r) => r.name !== "Chủ cửa hàng")
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleUpdate}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tài khoản: <span className="font-medium text-foreground">{resetUser?.username}</span>
            </p>
            <div>
              <Label>Mật khẩu mới *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="min 6 ký tự"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={handleReset}>Đặt lại</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xác nhận xoá tài khoản"
        message="Bạn có chắc chắn muốn xoá tài khoản này? Hành động này không thể hoàn tác."
        itemName={deleteTarget?.fullName}
        itemCode={deleteTarget?.username}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
