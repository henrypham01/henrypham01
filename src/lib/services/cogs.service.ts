import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export async function getWeightedAverageCost(productId: string): Promise<Decimal> {
  const lastMovement = await prisma.stockMovement.findFirst({
    where: { productId },
    orderBy: { movementDate: "desc" },
  });

  if (!lastMovement || new Decimal(lastMovement.balanceQty.toString()).eq(0)) {
    return new Decimal(0);
  }

  return new Decimal(lastMovement.balanceCost.toString()).div(
    new Decimal(lastMovement.balanceQty.toString())
  );
}

export async function recordStockIn(
  productId: string,
  quantity: Decimal,
  unitCost: Decimal,
  notes?: string,
  tx?: Tx
) {
  const db = tx ?? prisma;
  const lastMovement = await db.stockMovement.findFirst({
    where: { productId },
    orderBy: { movementDate: "desc" },
  });

  const prevBalanceQty = lastMovement
    ? new Decimal(lastMovement.balanceQty.toString())
    : new Decimal(0);
  const prevBalanceCost = lastMovement
    ? new Decimal(lastMovement.balanceCost.toString())
    : new Decimal(0);

  const totalCost = quantity.mul(unitCost);
  const newBalanceQty = prevBalanceQty.add(quantity);
  const newBalanceCost = prevBalanceCost.add(totalCost);

  if (tx) {
    await tx.stockMovement.create({
      data: {
        productId,
        movementType: "STOCK_IN",
        quantity: quantity.toNumber(),
        unitCost: unitCost.toNumber(),
        totalCost: totalCost.toNumber(),
        balanceQty: newBalanceQty.toNumber(),
        balanceCost: newBalanceCost.toNumber(),
        notes,
      },
    });
    await tx.product.update({
      where: { id: productId },
      data: { currentStock: newBalanceQty.toNumber() },
    });
  } else {
    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId,
          movementType: "STOCK_IN",
          quantity: quantity.toNumber(),
          unitCost: unitCost.toNumber(),
          totalCost: totalCost.toNumber(),
          balanceQty: newBalanceQty.toNumber(),
          balanceCost: newBalanceCost.toNumber(),
          notes,
        },
      }),
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newBalanceQty.toNumber() },
      }),
    ]);
  }
}

export type StockOutResult = {
  cogs: Decimal;
  warning?: string; // if stock went negative
};

export type StockOutOptions = {
  deliveryNoteId?: string;
  invoiceId?: string;
  notes?: string;
  tx?: Tx;
};

export async function recordStockOut(
  productId: string,
  quantity: Decimal,
  options: StockOutOptions = {}
): Promise<StockOutResult> {
  const { deliveryNoteId, invoiceId, notes, tx } = options;
  const db = tx ?? prisma;
  const lastMovement = await db.stockMovement.findFirst({
    where: { productId },
    orderBy: { movementDate: "desc" },
  });

  const prevBalanceQty = lastMovement
    ? new Decimal(lastMovement.balanceQty.toString())
    : new Decimal(0);
  const prevBalanceCost = lastMovement
    ? new Decimal(lastMovement.balanceCost.toString())
    : new Decimal(0);

  // Weighted average cost per unit
  const avgCost = prevBalanceQty.gt(0)
    ? prevBalanceCost.div(prevBalanceQty)
    : new Decimal(0);

  const totalCost = quantity.mul(avgCost);
  const newBalanceQty = prevBalanceQty.sub(quantity);
  const newBalanceCost = prevBalanceCost.sub(totalCost);

  const warning = newBalanceQty.lt(0)
    ? `Tồn kho âm sau khi xuất (${newBalanceQty.toNumber()})`
    : undefined;

  const data = {
    productId,
    deliveryNoteId,
    invoiceId,
    movementType: "STOCK_OUT" as const,
    quantity: quantity.toNumber(),
    unitCost: avgCost.toNumber(),
    totalCost: totalCost.toNumber(),
    balanceQty: newBalanceQty.toNumber(),
    balanceCost: newBalanceCost.toNumber(),
    notes,
  };

  if (tx) {
    await tx.stockMovement.create({ data });
    await tx.product.update({
      where: { id: productId },
      data: { currentStock: newBalanceQty.toNumber() },
    });
  } else {
    await prisma.$transaction([
      prisma.stockMovement.create({ data }),
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newBalanceQty.toNumber() },
      }),
    ]);
  }

  return { cogs: totalCost, warning };
}

/**
 * Reverse a previous stock-out — creates a STOCK_IN movement restoring
 * the quantity to inventory, typically when an invoice is cancelled or
 * edited (old lines revert before new lines apply).
 *
 * Uses the current weighted-average cost as unit cost so the cost basis
 * restored equals what was removed (approximately — the avg cost may have
 * shifted since). Acceptable approximation for POS.
 */
export async function recordStockReversal(
  productId: string,
  quantity: Decimal,
  options: { invoiceId?: string; notes?: string; tx?: Tx } = {}
): Promise<void> {
  const { invoiceId, notes, tx } = options;
  const db = tx ?? prisma;
  const lastMovement = await db.stockMovement.findFirst({
    where: { productId },
    orderBy: { movementDate: "desc" },
  });

  const prevBalanceQty = lastMovement
    ? new Decimal(lastMovement.balanceQty.toString())
    : new Decimal(0);
  const prevBalanceCost = lastMovement
    ? new Decimal(lastMovement.balanceCost.toString())
    : new Decimal(0);

  const avgCost = prevBalanceQty.gt(0)
    ? prevBalanceCost.div(prevBalanceQty)
    : new Decimal(0);

  const totalCost = quantity.mul(avgCost);
  const newBalanceQty = prevBalanceQty.add(quantity);
  const newBalanceCost = prevBalanceCost.add(totalCost);

  const data = {
    productId,
    invoiceId,
    movementType: "STOCK_IN" as const,
    quantity: quantity.toNumber(),
    unitCost: avgCost.toNumber(),
    totalCost: totalCost.toNumber(),
    balanceQty: newBalanceQty.toNumber(),
    balanceCost: newBalanceCost.toNumber(),
    notes: notes || "Hoàn kho hoá đơn",
  };

  if (tx) {
    await tx.stockMovement.create({ data });
    await tx.product.update({
      where: { id: productId },
      data: { currentStock: newBalanceQty.toNumber() },
    });
  } else {
    await prisma.$transaction([
      prisma.stockMovement.create({ data }),
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newBalanceQty.toNumber() },
      }),
    ]);
  }
}
