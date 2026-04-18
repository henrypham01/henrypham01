"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { formatVND } from "@/lib/formatting";

export type LineItemData = {
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  lineTotal: number;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: string;
  vatRate: string;
};

interface LineItemsEditorProps {
  items: LineItemData[];
  onChange: (items: LineItemData[]) => void;
  readOnly?: boolean;
}

function calcLineTotal(item: LineItemData): number {
  const base = item.quantity * item.unitPrice;
  const discount = base * (item.discountPercent / 100);
  const afterDiscount = base - discount;
  const vat = afterDiscount * item.vatRate;
  return afterDiscount + vat;
}

export function LineItemsEditor({ items, onChange, readOnly }: LineItemsEditorProps) {
  const t = useTranslations("lineItems");
  const [products, setProducts] = useState<Product[]>([]);

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addLine = () => {
    onChange([
      ...items,
      {
        productId: "",
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        vatRate: 0.1,
        lineTotal: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineItemData, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };

      if (field === "productId") {
        const product = products.find((p) => p.id === value);
        if (product) {
          newItem.unitPrice = parseFloat(product.sellingPrice);
          newItem.vatRate = parseFloat(product.vatRate);
          newItem.productName = product.name;
        }
      }

      newItem.lineTotal = calcLineTotal(newItem);
      return newItem;
    });
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="min-w-[200px]">{t("product")}</TableHead>
            <TableHead className="w-24">{t("quantity")}</TableHead>
            <TableHead className="w-32">{t("unitPrice")}</TableHead>
            <TableHead className="w-20">{t("discount")}</TableHead>
            <TableHead className="w-20">{t("vat")}</TableHead>
            <TableHead className="w-32 text-right">{t("lineTotal")}</TableHead>
            {!readOnly && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>
                {readOnly ? (
                  item.productName || item.productId
                ) : (
                  <Select
                    value={item.productId || "none"}
                    onValueChange={(v) =>
                      updateLine(index, "productId", !v || v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("product")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={(e) =>
                    updateLine(index, "quantity", parseFloat(e.target.value) || 0)
                  }
                  disabled={readOnly}
                  className="w-20"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)
                  }
                  disabled={readOnly}
                  className="w-28"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.discountPercent}
                  onChange={(e) =>
                    updateLine(index, "discountPercent", parseFloat(e.target.value) || 0)
                  }
                  disabled={readOnly}
                  className="w-16"
                />
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {(item.vatRate * 100).toFixed(0)}%
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatVND(item.lineTotal)}
              </TableCell>
              {!readOnly && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addLine} className="mt-2">
          <Plus className="mr-2 h-4 w-4" />
          {t("addLine")}
        </Button>
      )}
    </div>
  );
}
