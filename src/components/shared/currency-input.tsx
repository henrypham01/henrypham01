"use client";

import { Input } from "@/components/ui/input";
import { formatVND, parseVND } from "@/lib/formatting";

interface CurrencyInputProps {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CurrencyInput({ value, onChange, disabled }: CurrencyInputProps) {
  const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
  const displayValue = formatVND(numValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    onChange(raw || "0");
  };

  return (
    <Input
      value={displayValue}
      onChange={handleChange}
      disabled={disabled}
      className="text-right"
      inputMode="numeric"
    />
  );
}
