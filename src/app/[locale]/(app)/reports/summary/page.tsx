"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  CreditCard,
  ShoppingCart,
  Package,
  DollarSign,
} from "lucide-react";
import { formatVND } from "@/lib/formatting";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Summary = {
  orders: { count: number; total: number };
  invoices: { count: number; total: number };
  payments: { count: number; total: number };
  cogs: number;
  grossProfit: number;
  topProducts: { id: string; name: string; quantity: number; revenue: number }[];
  byDay?: { date: string; revenue: number; cogs: number; payments: number }[];
};

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "green" | "orange" | "purple";
}) {
  const accentClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    orange: "bg-orange-500/10 text-orange-600",
    purple: "bg-purple-500/10 text-purple-600",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? accentClasses[accent] : "bg-muted text-muted-foreground"}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SummaryReportPage() {
  const router = useRouter();
  const { locale } = useParams();
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");

  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<Summary | null>(null);

  const fetchData = useCallback(async () => {
    const url =
      tab === "daily"
        ? `/api/reports?type=summary-daily&date=${date}`
        : `/api/reports?type=summary-monthly&month=${month}`;
    const res = await fetch(url);
    setData(await res.json());
  }, [tab, date, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/reports`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Báo cáo tổng hợp
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tổng hợp kinh doanh theo ngày / tháng
            </p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "daily" | "monthly")}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <TabsList>
            <TabsTrigger value="daily">Cuối ngày</TabsTrigger>
            <TabsTrigger value="monthly">Cuối tháng</TabsTrigger>
          </TabsList>
          {tab === "daily" ? (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Ngày:</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Tháng:</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-[180px]"
              />
            </div>
          )}
        </div>

        <TabsContent value="daily">
          {data && <SummaryView data={data} />}
        </TabsContent>
        <TabsContent value="monthly">
          {data && (
            <>
              <SummaryView data={data} />
              {data.byDay && data.byDay.length > 0 && (
                <Card className="mt-4">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-3">
                      Biểu đồ theo ngày
                    </p>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.byDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            fontSize={11}
                            tickFormatter={(v: string) => v.slice(8)}
                          />
                          <YAxis
                            fontSize={11}
                            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          />
                          <Tooltip formatter={(v) => formatVND(Number(v))} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#2563eb"
                            name="Doanh thu"
                          />
                          <Line
                            type="monotone"
                            dataKey="cogs"
                            stroke="#f97316"
                            name="Giá vốn"
                          />
                          <Line
                            type="monotone"
                            dataKey="payments"
                            stroke="#16a34a"
                            name="Thu tiền"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryView({ data }: { data: Summary }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard
          icon={ShoppingCart}
          label="Đơn đặt hàng"
          value={String(data.orders.count)}
          sub={formatVND(data.orders.total)}
          accent="primary"
        />
        <KpiCard
          icon={TrendingUp}
          label="Doanh thu"
          value={formatVND(data.invoices.total)}
          sub={`${data.invoices.count} hoá đơn`}
          accent="green"
        />
        <KpiCard
          icon={CreditCard}
          label="Thu tiền"
          value={formatVND(data.payments.total)}
          sub={`${data.payments.count} phiếu thu`}
          accent="purple"
        />
        <KpiCard
          icon={Package}
          label="Giá vốn"
          value={formatVND(data.cogs)}
          accent="orange"
        />
        <KpiCard
          icon={DollarSign}
          label="Lợi nhuận gộp"
          value={formatVND(data.grossProfit)}
          sub={
            data.invoices.total > 0
              ? `${((data.grossProfit / data.invoices.total) * 100).toFixed(1)}%`
              : "-"
          }
          accent={data.grossProfit >= 0 ? "green" : "orange"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">Sản phẩm bán chạy</p>
          {data.topProducts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">
              Chưa có dữ liệu
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Sản phẩm</th>
                  <th className="text-right py-2">Số lượng</th>
                  <th className="text-right py-2">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-right">
                      {p.quantity.toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatVND(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
