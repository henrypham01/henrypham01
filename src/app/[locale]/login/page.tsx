"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Đăng nhập thất bại");
        return;
      }
      toast.success("Đăng nhập thành công");
      router.push(`/${locale}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-md mb-4 ring-1 ring-border">
            <Image src="/logo.png" alt="THU PHÁP COSMETIC" width={68} height={48} className="h-12 w-auto" />
          </div>
          <h1 className="text-xl font-bold tracking-wide" style={{ color: "#9D7536" }}>
            THU PHÁP
          </h1>
          <p className="text-xs tracking-[0.2em] font-medium" style={{ color: "#B7995E" }}>
            COSMETIC
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-lg">
          <h2 className="mb-1 text-lg font-semibold">Đăng nhập</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            Vui lòng đăng nhập để sử dụng hệ thống
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-sm">
                Tên đăng nhập
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="admin"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm">
                Mật khẩu
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Đăng nhập
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
