"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/navigation";

interface SidebarProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();

  const isActive = (href: string) => {
    const localePath = pathname.replace(/^\/(vi|en)/, "");
    if (href === "/") return localePath === "" || localePath === "/";
    return localePath.startsWith(href);
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {navGroups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <p className="mb-2 px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.12em]">
              {t(group.titleKey)}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150",
                      active
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(item.titleKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SidebarLogo() {
  return (
    <div className="flex h-16 items-center border-b border-sidebar-border px-4">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/logo.png" alt="THU PHÁP COSMETIC" width={50} height={36} className="h-9 w-auto" />
        <div className="flex flex-col items-center leading-tight">
          <span className="font-bold text-sm tracking-wide text-white">THU PHÁP</span>
          <span className="text-[9px] tracking-[0.2em] font-medium text-white/60">COSMETIC</span>
        </div>
      </Link>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-full w-60 flex-col bg-sidebar shrink-0">
      <SidebarLogo />
      <SidebarContent />
    </aside>
  );
}
