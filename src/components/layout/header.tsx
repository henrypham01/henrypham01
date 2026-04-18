"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Languages, Menu, LogOut, User as UserIcon } from "lucide-react";
import { SidebarContent, SidebarLogo } from "./sidebar";
import { toast } from "sonner";

type Me = {
  username: string;
  fullName: string;
  role: { name: string };
};

export function Header() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (r.status === 401) {
          // Session expired or invalid → bounce to login
          router.replace(`/${locale}/login`);
          return;
        }
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setMe(data);
        }
      } catch {
        // Network error: leave skeleton, don't bounce
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  const toggleLocale = () => {
    const newLocale = locale === "vi" ? "en" : "vi";
    const pathWithoutLocale = pathname.replace(/^\/(vi|en)/, "");
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Đã đăng xuất");
    router.push(`/${locale}/login`);
    router.refresh();
  };

  const initials = me
    ? (me.fullName || me.username)
        .split(" ")
        .slice(-2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "";

  return (
    <>
      <header className="flex h-14 items-center border-b bg-card px-4 gap-3 shadow-sm">
        <button
          type="button"
          className="md:hidden p-2 -ml-1 rounded-md active:bg-accent touch-manipulation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="md:hidden flex items-center gap-2 flex-1">
          <Image src="/logo.png" alt="THU PHÁP COSMETIC" width={40} height={28} className="h-7 w-auto" />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-xs tracking-wide" style={{ color: "#9D7536" }}>THU PHÁP</span>
            <span className="text-[8px] tracking-[0.15em]" style={{ color: "#B7995E" }}>COSMETIC</span>
          </div>
        </div>
        <div className="hidden md:block flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLocale}
          className="gap-1.5 text-xs h-8"
        >
          <Languages className="h-3.5 w-3.5" />
          {locale === "vi" ? "EN" : "VI"}
        </Button>

        {me ? (
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger className="flex items-center gap-2 rounded-md border border-input bg-background px-2 h-8 shadow-xs hover:bg-accent">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {initials || <UserIcon className="h-3 w-3" />}
              </div>
              <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">
                {me.fullName || me.username}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="mb-2 border-b px-2 py-2">
                <div className="text-sm font-semibold truncate">{me.fullName}</div>
                <div className="text-xs text-muted-foreground truncate">@{me.username}</div>
                <div className="text-xs text-primary mt-0.5">{me.role.name}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2 h-8">
            <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
            <div className="hidden sm:block h-3 w-20 rounded bg-muted animate-pulse" />
          </div>
        )}
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarLogo />
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
