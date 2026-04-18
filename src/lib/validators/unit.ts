import { z } from "zod";

export const unitSchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  nameEn: z.string().max(100).optional().nullable(),
});

export type UnitFormData = z.infer<typeof unitSchema>;
