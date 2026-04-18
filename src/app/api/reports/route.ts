import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to + "T23:59:59");

  if (type === "revenue-by-product") {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["CHO_IN", "DA_IN"] },
        ...(from || to ? { issueDate: dateFilter } : {}),
      },
      include: {
        lineItems: {
          include: { product: true },
        },
      },
    });

    const productMap: Record<string, { name: string; revenue: number; quantity: number }> = {};
    for (const inv of invoices) {
      for (const li of inv.lineItems) {
        const pid = li.productId;
        if (!productMap[pid]) {
          productMap[pid] = { name: li.product.name, revenue: 0, quantity: 0 };
        }
        productMap[pid].revenue += parseFloat(li.lineTotal.toString());
        productMap[pid].quantity += parseFloat(li.quantity.toString());
      }
    }

    const data = Object.entries(productMap)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json(data);
  }

  if (type === "revenue-by-region") {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["CHO_IN", "DA_IN"] },
        ...(from || to ? { issueDate: dateFilter } : {}),
      },
      include: { customer: true },
    });

    const regionMap: Record<string, number> = {};
    for (const inv of invoices) {
      const region = inv.customer.region || "N/A";
      regionMap[region] = (regionMap[region] || 0) + parseFloat(inv.totalAmount.toString());
    }

    const data = Object.entries(regionMap)
      .map(([region, revenue]) => ({ region, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json(data);
  }

  if (type === "profit") {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["CHO_IN", "DA_IN"] },
        ...(from || to ? { issueDate: dateFilter } : {}),
      },
      include: {
        lineItems: { include: { product: true } },
        stockMovements: true,
        deliveryNotes: { include: { stockMovements: true } }, // legacy
      },
    });

    const productMap: Record<string, { name: string; revenue: number; cogs: number }> = {};

    for (const inv of invoices) {
      for (const li of inv.lineItems) {
        const pid = li.productId;
        if (!productMap[pid]) {
          productMap[pid] = { name: li.product.name, revenue: 0, cogs: 0 };
        }
        productMap[pid].revenue += parseFloat(li.lineTotal.toString());
      }
      // New POS flow: stock movements linked directly to invoice
      for (const sm of inv.stockMovements) {
        const pid = sm.productId;
        if (!productMap[pid]) {
          const product = await prisma.product.findUnique({ where: { id: pid } });
          productMap[pid] = { name: product?.name || "Unknown", revenue: 0, cogs: 0 };
        }
        // STOCK_OUT increases COGS, STOCK_IN (reversal) decreases it
        const sign = sm.movementType === "STOCK_OUT" ? 1 : -1;
        productMap[pid].cogs += sign * parseFloat(sm.totalCost.toString());
      }
      // Legacy: invoices that still have delivery notes
      for (const dn of inv.deliveryNotes) {
        for (const sm of dn.stockMovements) {
          const pid = sm.productId;
          if (!productMap[pid]) {
            const product = await prisma.product.findUnique({ where: { id: pid } });
            productMap[pid] = { name: product?.name || "Unknown", revenue: 0, cogs: 0 };
          }
          productMap[pid].cogs += parseFloat(sm.totalCost.toString());
        }
      }
    }

    const data = Object.entries(productMap)
      .map(([id, v]) => ({
        id,
        name: v.name,
        revenue: v.revenue,
        cogs: v.cogs,
        grossProfit: v.revenue - v.cogs,
        margin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.grossProfit - a.grossProfit);

    return NextResponse.json(data);
  }

  if (type === "inventory") {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { baseUnit: true, category: true },
      orderBy: { name: "asc" },
    });

    const data = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name || "-",
      unit: p.baseUnit.name,
      currentStock: parseFloat(p.currentStock.toString()),
      minStock: parseFloat(p.minStock.toString()),
      maxStock: parseFloat(p.maxStock.toString()),
      belowMin:
        parseFloat(p.minStock.toString()) > 0 &&
        parseFloat(p.currentStock.toString()) < parseFloat(p.minStock.toString()),
    }));

    return NextResponse.json(data);
  }

  if (type === "summary-daily") {
    const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const start = new Date(dateStr + "T00:00:00");
    const end = new Date(dateStr + "T23:59:59.999");
    const data = await buildSummary(start, end);
    return NextResponse.json({ date: dateStr, ...data });
  }

  if (type === "summary-monthly") {
    const monthStr =
      searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const data = await buildSummary(start, end);

    // Per-day breakdown
    const days = end.getDate();
    const byDay: Array<{ date: string; revenue: number; cogs: number; payments: number }> = [];
    for (let d = 1; d <= days; d++) {
      const ds = new Date(y, m - 1, d, 0, 0, 0);
      const de = new Date(y, m - 1, d, 23, 59, 59, 999);
      const day = await buildSummary(ds, de);
      byDay.push({
        date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        revenue: day.invoices.total,
        cogs: day.cogs,
        payments: day.payments.total,
      });
    }

    return NextResponse.json({ month: monthStr, ...data, byDay });
  }

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
}

async function buildSummary(start: Date, end: Date) {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["CHO_IN", "DA_IN"] },
      issueDate: { gte: start, lte: end },
    },
    include: {
      lineItems: { include: { product: true } },
      stockMovements: true,
      deliveryNotes: { include: { stockMovements: true } }, // legacy
    },
  });

  const salesOrders = await prisma.salesOrder.findMany({
    where: { issueDate: { gte: start, lte: end } },
    select: { id: true, totalAmount: true },
  });

  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: start, lte: end } },
    select: { id: true, amount: true },
  });

  const invoiceTotal = invoices.reduce(
    (s, i) => s + parseFloat(i.totalAmount.toString()),
    0
  );
  const ordersTotal = salesOrders.reduce(
    (s, o) => s + parseFloat(o.totalAmount.toString()),
    0
  );
  const paymentsTotal = payments.reduce(
    (s, p) => s + parseFloat(p.amount.toString()),
    0
  );

  let cogs = 0;
  const topMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

  for (const inv of invoices) {
    for (const li of inv.lineItems) {
      const pid = li.productId;
      if (!topMap[pid]) {
        topMap[pid] = { name: li.product.name, quantity: 0, revenue: 0 };
      }
      topMap[pid].quantity += parseFloat(li.quantity.toString());
      topMap[pid].revenue += parseFloat(li.lineTotal.toString());
    }
    // New POS flow: stock movements linked directly to invoice
    for (const sm of inv.stockMovements) {
      const sign = sm.movementType === "STOCK_OUT" ? 1 : -1;
      cogs += sign * parseFloat(sm.totalCost.toString());
    }
    // Legacy: delivery note stock movements
    for (const dn of inv.deliveryNotes) {
      for (const sm of dn.stockMovements) {
        cogs += parseFloat(sm.totalCost.toString());
      }
    }
  }

  const topProducts = Object.entries(topMap)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    orders: { count: salesOrders.length, total: ordersTotal },
    invoices: { count: invoices.length, total: invoiceTotal },
    payments: { count: payments.length, total: paymentsTotal },
    cogs,
    grossProfit: invoiceTotal - cogs,
    topProducts,
  };
}
