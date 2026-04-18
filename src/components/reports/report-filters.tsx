"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportFiltersProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onFilter: () => void;
}

export function ReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  onFilter,
}: ReportFiltersProps) {
  const t = useTranslations("reports");

  return (
    <div className="flex items-end gap-4 mb-6">
      <div>
        <Label>{t("from")}</Label>
        <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
      </div>
      <div>
        <Label>{t("to")}</Label>
        <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
      </div>
      <Button onClick={onFilter}>{t("filter")}</Button>
    </div>
  );
}
