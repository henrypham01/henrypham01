import { z } from "zod";

export const productSchema = z
  .object({
    // Server auto-generates SKU when this is empty/missing (safe in create tx)
    sku: z.string().max(50).optional().default(""),
    barcode: z.string().max(100).optional().nullable(),
    name: z.string().min(1, "Tên hàng là bắt buộc").max(255),
    nameEn: z.string().max(200).optional().nullable(),
    description: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    baseUnitId: z.string().min(1, "Đơn vị tính là bắt buộc"),
    supplierId: z.string().optional().nullable(),
    brandId: z.string().optional().nullable(),
    costPrice: z.coerce.number().min(0).default(0),
    sellingPrice: z.coerce.number().min(0).default(0),
    vatRate: z.coerce.number().min(0).max(1).default(0.1),
    minStock: z.coerce.number().min(0).default(0),
    maxStock: z.coerce.number().min(0).default(0),
    origin: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
    // Initial stock (create only — ignored on edit). Creates an INITIAL
    // StockMovement so subsequent bán/xuất accounting works correctly.
    initialStock: z.coerce.number().min(0).optional(),
    initialCost: z.coerce.number().min(0).optional(),
    // Cosmetics / supplements fields
    batchNumber: z.string().max(100).optional().nullable(),
    manufacturingDate: z.coerce.date().optional().nullable(),
    expiryDate: z.coerce.date().optional().nullable(),
    registrationNumber: z.string().max(100).optional().nullable(),
    usageFunction: z.string().max(100).optional().nullable(),
  })
  .refine(
    (d) =>
      !d.manufacturingDate ||
      !d.expiryDate ||
      d.expiryDate > d.manufacturingDate,
    {
      message: "Hạn sử dụng phải sau ngày sản xuất",
      path: ["expiryDate"],
    }
  );

export type ProductFormData = z.infer<typeof productSchema>;
