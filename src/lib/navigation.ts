import {
  LayoutDashboard,
  Package,
  PackagePlus,
  Ruler,
  FolderTree,
  Users,
  UserCog,
  FileText,
  ClipboardList,
  Receipt,
  Truck,
  CreditCard,
  BarChart3,
  TrendingUp,
  Warehouse,
  Settings,
  Factory,
  Tag,
  AlertTriangle,
  Calendar,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  titleKey: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  titleKey: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    titleKey: "nav.dashboard",
    items: [
      { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    titleKey: "nav.catalog",
    items: [
      { titleKey: "nav.productList", href: "/products", icon: Package },
      { titleKey: "nav.purchaseOrders", href: "/products/purchases", icon: PackagePlus },
      { titleKey: "nav.productGroups", href: "/products/groups", icon: FolderTree },
      { titleKey: "nav.units", href: "/units", icon: Ruler },
      { titleKey: "nav.suppliers", href: "/suppliers", icon: Factory },
      { titleKey: "nav.brands", href: "/brands", icon: Tag },
    ],
  },
  {
    titleKey: "nav.sales",
    items: [
      { titleKey: "nav.customers", href: "/customers", icon: Users },
      { titleKey: "nav.invoices", href: "/invoices", icon: Receipt },
    ],
  },
  {
    titleKey: "nav.reports",
    items: [
      { titleKey: "nav.revenue", href: "/reports/revenue", icon: BarChart3 },
      { titleKey: "nav.profit", href: "/reports/profit", icon: TrendingUp },
      { titleKey: "nav.inventory", href: "/reports/inventory", icon: Warehouse },
      { titleKey: "nav.expiryAlerts", href: "/reports/expiry", icon: AlertTriangle },
      { titleKey: "nav.summary", href: "/reports/summary", icon: Calendar },
    ],
  },
  {
    titleKey: "nav.settings",
    items: [
      { titleKey: "nav.users", href: "/settings/users", icon: UserCog },
      { titleKey: "nav.settings", href: "/settings", icon: Settings },
    ],
  },
];
