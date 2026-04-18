"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Printer, Building2, RefreshCw, CheckCircle2, CircleAlert } from "lucide-react";
import {
  getElectron,
  isElectron,
  type ElectronPrinter,
} from "@/lib/electron-bridge";

export default function SettingsPage() {
  const t = useTranslations();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [printers, setPrinters] = useState<ElectronPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [electron, setElectron] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    setSettings(await res.json());
  }, []);

  const fetchPrinters = useCallback(async () => {
    const api = getElectron();
    if (!api) {
      setPrinters([]);
      return;
    }
    setLoadingPrinters(true);
    try {
      const list = await api.listPrinters();
      setPrinters(list);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setElectron(isElectron());
    fetchPrinters();
  }, [fetchPrinters]);

  const handleSave = async () => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      toast.success(t("settings.saveSuccess"));
    } else {
      toast.error("Lưu thất bại");
    }
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const testPrint = async (size: "k80" | "a6") => {
    const api = getElectron();
    if (!api) {
      toast.error("Chỉ hoạt động trong ứng dụng Desktop (Electron)");
      return;
    }
    const deviceName =
      size === "k80"
        ? settings.print_k80_printer
        : settings.print_a6_printer;
    if (!deviceName) {
      toast.error("Chưa chọn máy in cho khổ " + size.toUpperCase());
      return;
    }
    // Minimal test print — 1 short line
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;padding:8px;">
      <div style="text-align:center;font-weight:bold;">Test in</div>
      <div style="text-align:center;font-size:11px;margin-top:4px;">Máy in: ${deviceName}</div>
      <div style="text-align:center;font-size:11px;">Khổ giấy: ${size.toUpperCase()}</div>
      <div style="text-align:center;font-size:11px;">${new Date().toLocaleString("vi-VN")}</div>
      </body></html>`;
    const res = await api.printInvoice({ html, size, deviceName });
    if (res.ok) toast.success("Đã gửi lệnh in thử");
    else toast.error(`In thử thất bại: ${res.error}`);
  };

  const printerOptions = [
    { value: "", label: "- Chọn máy in -" },
    ...printers.map((p) => ({
      value: p.name,
      label: p.isDefault ? `${p.displayName} (mặc định)` : p.displayName,
    })),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

      <Tabs defaultValue="company" className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Thông tin công ty
          </TabsTrigger>
          <TabsTrigger value="print" className="gap-1.5">
            <Printer className="h-4 w-4" /> In ấn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin công ty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("settings.companyName")}</Label>
                <Input
                  value={settings.company_name || ""}
                  onChange={(e) => update("company_name", e.target.value)}
                />
              </div>
              <div>
                <Label>{t("settings.companyAddress")}</Label>
                <Input
                  value={settings.company_address || ""}
                  onChange={(e) => update("company_address", e.target.value)}
                />
              </div>
              <div>
                <Label>{t("settings.companyTaxId")}</Label>
                <Input
                  value={settings.company_tax_id || ""}
                  onChange={(e) => update("company_tax_id", e.target.value)}
                />
              </div>
              <div>
                <Label>{t("settings.companyPhone")}</Label>
                <Input
                  value={settings.company_phone || ""}
                  onChange={(e) => update("company_phone", e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave}>{t("common.save")}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="print" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Cấu hình máy in
                {electron ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Đang chạy Desktop
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                    <CircleAlert className="h-3 w-3" />
                    Chế độ trình duyệt
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!electron && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Bạn đang mở ứng dụng qua trình duyệt web. Tính năng in tự
                  động / chọn máy in chỉ hoạt động khi bạn mở ứng dụng Desktop.
                  Trong trình duyệt, khi in sẽ hiện hộp thoại hệ thống để chọn
                  máy in thủ công.
                </div>
              )}

              {/* K80 printer */}
              <div>
                <div className="flex items-center justify-between">
                  <Label>
                    Máy in khổ K80 (hoá đơn bán hàng)
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      80mm — máy in nhiệt, ví dụ Xprinter XP-H200U
                    </span>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchPrinters}
                    disabled={!electron || loadingPrinters}
                    className="gap-1.5"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        loadingPrinters ? "animate-spin" : ""
                      }`}
                    />
                    Làm mới
                  </Button>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <div className="flex-1">
                    {electron ? (
                      <Select
                        value={settings.print_k80_printer || ""}
                        onValueChange={(v) =>
                          update(
                            "print_k80_printer",
                            !v || v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {settings.print_k80_printer ||
                              "- Chọn máy in -"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {printerOptions.map((o) => (
                            <SelectItem
                              key={o.value || "__none__"}
                              value={o.value || "__none__"}
                            >
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="VD: Xprinter XP-H200U"
                        value={settings.print_k80_printer || ""}
                        onChange={(e) =>
                          update("print_k80_printer", e.target.value)
                        }
                      />
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!electron || !settings.print_k80_printer}
                    onClick={() => testPrint("k80")}
                  >
                    In thử
                  </Button>
                </div>
              </div>

              {/* A6 printer */}
              <div>
                <Label>
                  Máy in khổ A6 (hoá đơn giao hàng / label)
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    105×148mm — ví dụ Xprinter XP-420B
                  </span>
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <div className="flex-1">
                    {electron ? (
                      <Select
                        value={settings.print_a6_printer || ""}
                        onValueChange={(v) =>
                          update(
                            "print_a6_printer",
                            !v || v === "__none__" ? "" : v
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {settings.print_a6_printer ||
                              "- Chọn máy in -"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {printerOptions.map((o) => (
                            <SelectItem
                              key={o.value || "__none__"}
                              value={o.value || "__none__"}
                            >
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="VD: Xprinter XP-420B"
                        value={settings.print_a6_printer || ""}
                        onChange={(e) =>
                          update("print_a6_printer", e.target.value)
                        }
                      />
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!electron || !settings.print_a6_printer}
                    onClick={() => testPrint("a6")}
                  >
                    In thử
                  </Button>
                </div>
              </div>

              {/* Auto-print size */}
              <div>
                <Label>
                  Khổ mặc định khi bấm "Thanh toán"
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Áp dụng khi tạo hoá đơn mới
                  </span>
                </Label>
                <Select
                  value={settings.print_default_size || "k80"}
                  onValueChange={(v) =>
                    update("print_default_size", v || "k80")
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="k80">K80 (hoá đơn nhiệt)</SelectItem>
                    <SelectItem value="a6">A6 (hoá đơn giao hàng)</SelectItem>
                    <SelectItem value="none">
                      Không in tự động (chỉ lưu)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Footer message */}
              <div>
                <Label>Lời cảm ơn cuối hoá đơn</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Cảm ơn Quý khách và hẹn gặp lại!"
                  value={settings.print_footer_message || ""}
                  onChange={(e) =>
                    update("print_footer_message", e.target.value)
                  }
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave}>{t("common.save")}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
