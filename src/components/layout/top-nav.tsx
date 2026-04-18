"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Languages, Menu, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { SidebarContent, SidebarLogo } from "./sidebar";
import { toast } from "sonner";
import { navGroups, type NavGroup, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type Me = {
  username: string;
  fullName: string;
  role: { name: string };
};

export function TopNav() {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (r.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setMe(data);
        }
      } catch {
        /* leave skeleton */
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

  const localePath = pathname.replace(/^\/(vi|en)/, "") || "/";
  const isItemActive = (href: string) => {
    if (href === "/") return localePath === "/" || localePath === "";
    return localePath.startsWith(href);
  };
  const isGroupActive = (group: NavGroup) =>
    group.items.some((it) => isItemActive(it.href));

  // Split into: first group (dashboard single link) + rest as dropdowns
  const [firstGroup, ...otherGroups] = navGroups;
  const dashboardItem: NavItem | undefined = firstGroup?.items[0];

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-card px-4 gap-2 shadow-sm">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 -ml-1 rounded-md active:bg-accent touch-manipulation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo.png"
            alt="THU PHÁP COSMETIC"
            width={40}
            height={28}
            className="h-7 w-auto"
          />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-bold text-xs tracking-wide" style={{ color: "#9D7536" }}>
              THU PHÁP
            </span>
            <span
              className="text-[8px] tracking-[0.15em]"
              style={{ color: "#B7995E" }}
            >
              COSMETIC
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {/* Dashboard standalone */}
          {dashboardItem && (
            <Link
              href={dashboardItem.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 h-9 text-sm transition-colors",
                isItemActive(dashboardItem.href)
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-accent text-foreground/80"
              )}
            >
              <dashboardItem.icon className="h-4 w-4" />
              {t(dashboardItem.titleKey)}
            </Link>
          )}

          {/* Dropdown groups */}
          {otherGroups.map((group, gi) => {
            const active = isGroupActive(group);
            const open = openGroup === gi;
            return (
              <Popover
                key={gi}
                open={open}
                onOpenChange={(v) => setOpenGroup(v ? gi : null)}
              >
                <PopoverTrigger
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 h-9 text-sm transition-colors",
                    active || open
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground/80"
                  )}
                >
                  {t(group.titleKey)}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-56 p-1"
                >
                  <ul className="flex flex-col">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const itemActive = isItemActive(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                              itemActive
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-accent text-foreground/80"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {t(item.titleKey)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </PopoverContent>
              </Popover>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Right: lang toggle + user */}
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
              <span className="hidden sm:inline text-xs font-medium max-w-[140px] truncate">
                {me.fullName || me.username}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="mb-2 border-b px-2 py-2">
                <div className="text-sm font-semibold truncate">{me.fullName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  @{me.username}
                </div>
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

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-sidebar border-sidebar-border"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarLogo />
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
