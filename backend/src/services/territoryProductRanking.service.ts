import { prisma } from "../lib/prisma";
import { ownerNamesFor } from "./territoryKpi.service";
import { TerritoryProductQuery } from "../validators/territoryProductRanking.validators";
import { monthsInPeriod, monthsWhereOr } from "./period.util";

// Product Master & Ranking Rules ข้อ 4 — mandatory first-phase warning, verbatim.
export const ZERO_SALE_WARNING =
  "ทะเบียนสินค้าปัจจุบันสร้างจากประวัติการขาย รายการนี้จึงหมายถึงสินค้าที่เขตอื่นขายได้แต่เขตนี้ยังไม่ได้ขาย ไม่ใช่ทั้งแคตตาล็อกของบริษัท";

interface CreditAggregates {
  productId: string;
  code: string | null;
  name: string;
  productType: { id: string; name: string };
  revenue: number;
  quantity: number;
}

export async function getTerritoryProductRanking(territoryId: string, period: TerritoryProductQuery) {
  const territory = await prisma.territory.findUnique({ where: { id: territoryId } });
  if (!territory) return null;

  const months = monthsInPeriod(period);
  const [products, current, historic, personal, ownerNames] = await Promise.all([
    prisma.product.findMany({ include: { productType: true }, orderBy: [{ productType: { name: "asc" } }, { name: "asc" }] }),
    // revenue(T)'s Territory KPI Rules ข้อ-2 math at product grain — SalesLineCredit only,
    // excluded personnel never count toward the territory.
    prisma.salesLineCredit.findMany({
      where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { hospital: { territoryId }, OR: monthsWhereOr(months) } },
      select: { sharePercent: true, salesLine: { select: { productId: true, qty: true, total: true } } },
    }),
    prisma.salesLineCredit.findMany({
      where: { salesperson: { excludedFromTerritoryTotals: false }, salesLine: { hospital: { territoryId } } },
      select: { salesLine: { select: { productId: true } } },
    }),
    prisma.salesLineCredit.findMany({
      where: { salesperson: { excludedFromTerritoryTotals: true }, salesLine: { OR: monthsWhereOr(months) } },
      select: { sharePercent: true, salesLine: { select: { productId: true, qty: true, total: true } } },
    }),
    // ข้อ 3's mandatory เขต + ผู้ดูแลเขต columns reuse Module N's period-effective owner lookup.
    ownerNamesFor(territoryId, period),
  ]);

  const reduce = (rows: (typeof current)[number][]) => {
    const totals = new Map<string, { revenue: number; quantity: number }>();
    for (const credit of rows) {
      const item = totals.get(credit.salesLine.productId) ?? { revenue: 0, quantity: 0 };
      item.revenue += Number(credit.salesLine.total) * Number(credit.sharePercent) / 100;
      item.quantity += Number(credit.salesLine.qty) * Number(credit.sharePercent) / 100;
      totals.set(credit.salesLine.productId, item);
    }
    return totals;
  };

  const totals = reduce(current);
  const personalTotals = reduce(personal);
  const historical = new Set(historic.map((credit) => credit.salesLine.productId));

  const serialize = (product: (typeof products)[number], values: Map<string, { revenue: number; quantity: number }>): CreditAggregates => {
    const item = values.get(product.id) ?? { revenue: 0, quantity: 0 };
    // Product.code null serializes as "—" here — never null/raw id to the frontend (ข้อ 3).
    return {
      productId: product.id,
      code: product.code ?? "—",
      name: product.displayName ?? product.name,
      productType: { id: product.productType.id, name: product.productType.name },
      revenue: item.revenue,
      quantity: item.quantity,
    };
  };

  // ข้อ 3: grouped by Product type, best→worst by Total inside each group; zero-revenue products
  // sink to the end of their group sorted by name with one of two explicit labels — never hidden.
  const items = products
    .map((product) => ({
      ...serialize(product, totals),
      zeroSaleStatus: totals.has(product.id) ? null : historical.has(product.id) ? "SOLD_BEFORE_NOT_IN_PERIOD" : "NEVER_SOLD_IN_TERRITORY",
    }))
    .sort(
      (a, b) =>
        a.productType.name.localeCompare(b.productType.name, "th") ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name)
    );

  const territoryOwners = ownerNames.length ? ownerNames : ["ยังไม่มีผู้ดูแล"];

  return {
    territory: { id: territory.id, name: territory.name, ownerNames: territoryOwners },
    items,
    personalBucket: products
      .filter((product) => personalTotals.has(product.id))
      .map((product) => serialize(product, personalTotals))
      .sort((a, b) => b.revenue - a.revenue),
    zeroSaleWarning: ZERO_SALE_WARNING,
  };
}
