import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validators/product";
import { Decimal } from "decimal.js";

/**
 * Generate the next SKU (SP000001, SP000002, …).
 *
 * Correctness does NOT depend on this call being atomic — the unique index
 * on `sku` is the final guard, and the caller retries on P2002.
 *
 * Note: we must filter to the strict "SP + 6 digits" pattern. Naïve
 * `startsWith: "SP"` also matches user-typed SKUs like "SP-FOO-123" where
 * parseInt would return NaN and stick this function at SP000001 forever.
 */
const SKU_PATTERN = /^SP(\d+)$/;

async function nextSku(): Promise<string> {
  // Scan up to 200 most-recent SP-prefixed rows to find the highest valid one.
  // 200 is plenty: this only runs on conflict/retry, and in steady state the
  // very first row already matches the pattern.
  const rows = await prisma.product.findMany({
    where: { sku: { startsWith: "SP" } },
    orderBy: { sku: "desc" },
    take: 200,
    select: { sku: true },
  });

  let maxNum = 0;
  for (const r of rows) {
    const m = r.sku.match(SKU_PATTERN);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  return `SP${String(maxNum + 1).padStart(6, "0")}`;
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string };
  return e.code === "P2002";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId");
  const supplierId = searchParams.get("supplierId");
  const brandId = searchParams.get("brandId");
  const stockStatus = searchParams.get("stockStatus"); // all | inStock | outOfStock | belowMin
  const starred = searchParams.get("starred");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const expiring = searchParams.get("expiring"); // 30 | 60 | 90
  const usageFunction = searchParams.get("usageFunction");

  const where: Record<string, unknown> = { isDeleted: false };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (supplierId) where.supplierId = supplierId;
  if (brandId) where.brandId = brandId;
  if (starred === "true") where.isStarred = true;

  if (stockStatus === "inStock") where.currentStock = { gt: 0 };
  else if (stockStatus === "outOfStock") where.currentStock = { lte: 0 };

  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) range.lte = new Date(dateTo);
    where.createdAt = range;
  }

  if (expiring) {
    const days = parseInt(expiring, 10);
    if (!isNaN(days) && days > 0) {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() + days);
      where.expiryDate = { not: null, lte: threshold };
    }
  }
  if (usageFunction) where.usageFunction = usageFunction;

  const products = await prisma.product.findMany({
    where,
    include: { category: true, baseUnit: true, supplier: true, brand: true },
    orderBy: { createdAt: "desc" },
  });

  // belowMin filter (post-query since it compares two fields)
  let filtered = products;
  if (stockStatus === "belowMin") {
    filtered = products.filter(
      (p) => Number(p.currentStock) < Number(p.minStock) && Number(p.minStock) > 0
    );
  }

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    categoryId,
    baseUnitId,
    supplierId,
    brandId,
    initialStock,
    initialCost,
    ...rest
  } = parsed.data;
  const userProvidedSku = rest.sku?.trim() || "";

  // Fast path for user-typed SKU: explicit duplicate check with a friendly
  // error, then single INSERT. Unique index still guards against races.
  if (userProvidedSku) {
    const existing = await prisma.product.findUnique({
      where: { sku: userProvidedSku },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: { sku: ["Mã hàng đã tồn tại"] } },
        { status: 400 }
      );
    }
  }

  // Auto-generated SKU: probe (compute next) + INSERT, retry on P2002.
  // We do NOT wrap this in $transaction — Prisma + better-sqlite3 doesn't
  // guarantee MAX() within a tx sees other tx's commits (tx snapshot), so
  // concurrent callers would loop forever. Outside tx, each retry re-reads
  // MAX against the latest committed state, so progress is guaranteed.
  const MAX_ATTEMPTS = 20;
  let lastError: unknown = null;
  let created: Awaited<ReturnType<typeof prisma.product.create>> | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sku = userProvidedSku || (await nextSku());
    try {
      created = await prisma.product.create({
        data: {
          ...rest,
          sku,
          baseUnit: { connect: { id: baseUnitId } },
          ...(categoryId && { category: { connect: { id: categoryId } } }),
          ...(supplierId && { supplier: { connect: { id: supplierId } } }),
          ...(brandId && { brand: { connect: { id: brandId } } }),
        },
      });
      break;
    } catch (err: unknown) {
      lastError = err;

      if (userProvidedSku && isUniqueViolation(err)) {
        return NextResponse.json(
          { error: { sku: ["Mã hàng đã tồn tại"] } },
          { status: 400 }
        );
      }

      if (!userProvidedSku && isUniqueViolation(err)) {
        const baseMs = 5 + attempt * 10;
        const jitterMs = Math.floor(Math.random() * 30);
        await new Promise((resolve) => setTimeout(resolve, baseMs + jitterMs));
        continue;
      }

      break;
    }
  }

  if (!created) {
    console.error("POST /api/products failed after retries:", lastError);
    return NextResponse.json(
      { error: "Không thể tạo hàng hoá" },
      { status: 500 }
    );
  }

  // Initial stock: write INITIAL movement + cache update as its own tx so
  // the ledger stays consistent with product.currentStock / costPrice.
  const qty = new Decimal(initialStock ?? 0);
  if (qty.gt(0)) {
    const unitCost = new Decimal(
      initialCost ?? created.costPrice.toString() ?? 0
    );
    const totalCost = qty.mul(unitCost);
    try {
      created = await prisma.$transaction(async (tx) => {
        await tx.stockMovement.create({
          data: {
            productId: created!.id,
            movementType: "INITIAL",
            quantity: qty.toNumber(),
            unitCost: unitCost.toNumber(),
            totalCost: totalCost.toNumber(),
            balanceQty: qty.toNumber(),
            balanceCost: totalCost.toNumber(),
            notes: "Tồn kho ban đầu",
          },
        });
        return tx.product.update({
          where: { id: created!.id },
          data: {
            currentStock: qty.toNumber(),
            costPrice: unitCost.toNumber(),
          },
        });
      });
    } catch (err) {
      // Product row already created; rolling back initial stock is acceptable.
      console.error(
        `Failed to record initial stock for product ${created.id}:`,
        err
      );
      return NextResponse.json(
        {
          error: "Tạo hàng hoá thành công nhưng không ghi được tồn ban đầu",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(created, { status: 201 });
}

// Bulk soft delete
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }
  const result = await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: { isDeleted: true },
  });
  return NextResponse.json({ count: result.count });
}
