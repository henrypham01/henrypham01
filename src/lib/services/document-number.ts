import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

type DocTable = "quotation" | "salesOrder" | "invoice" | "deliveryNote" | "payment";

const prefixMap: Record<DocTable, string> = {
  quotation: "BG",
  salesOrder: "DH",
  invoice: "HD",
  deliveryNote: "PXK",
  payment: "PT",
};

const tableNameMap: Record<DocTable, string> = {
  quotation: "quotations",
  salesOrder: "sales_orders",
  invoice: "invoices",
  deliveryNote: "delivery_notes",
  payment: "payments",
};

// Minimal interface Prisma.TransactionClient and PrismaClient both satisfy.
type PrismaExecutor = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

/**
 * Generate the next document number for the given document type.
 *
 * Race-safety: this function runs a MAX() lookup and returns the next value.
 * It MUST be called inside the same `prisma.$transaction(...)` that inserts
 * the document row, and the caller should pass the transaction client (`tx`)
 * as the second argument. SQLite's BEGIN IMMEDIATE (used by Prisma on write
 * transactions) serializes writers, so two concurrent callers cannot both
 * read the same MAX and both insert. The unique index on `documentNumber`
 * is the final guard.
 *
 * Falling back to the global `prisma` client is allowed for read-only / UI
 * "next code preview" callers that do not insert.
 */
export async function generateDocumentNumber(
  table: DocTable,
  executor: PrismaExecutor = prisma
): Promise<string> {
  const prefix = prefixMap[table];
  const tableName = tableNameMap[table];
  const dateStr = format(new Date(), "yyyyMMdd");
  const pattern = `${prefix}-${dateStr}-%`;

  const result = await executor.$queryRawUnsafe<{ max_num: string | null }[]>(
    `SELECT MAX(documentNumber) as max_num FROM ${tableName} WHERE documentNumber LIKE ?`,
    pattern
  );

  let nextNum = 1;
  const maxNum = result[0]?.max_num;
  if (maxNum) {
    const parts = maxNum.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}-${dateStr}-${String(nextNum).padStart(3, "0")}`;
}
