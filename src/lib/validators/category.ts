import { z } from "zod";

export const categorySchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  nameEn: z.string().max(100).optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
