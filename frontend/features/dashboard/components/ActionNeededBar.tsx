"use client";

/**
 * ActionNeededBar — WACC-P1-002
 *
 * Answers "what should I do next" from the payload the dashboard already loaded —
 * every condition below is evaluated from those fields alone. Zero new requests;
 * no threshold is invented and no backend-computed number is recomputed:
 *
 *  - churn: the count comes from `churnedCustomers`; the months shown are the payload's
 *    own `monthsSinceLastOrder` (worst case), because the dashboard payload does not
 *    carry the evaluation settings' `churnMonths` and fetching them would be a new request.
 *  - non-computable criteria: the reason text is rendered verbatim — it is authored
 *    server-side (KpiScoringService). The item links to /targets only when the first
 *    blocked metric is one whose reasons are all target-config problems
 *    (REVENUE_VS_TARGET / NEW_CUSTOMERS / PRODUCT_GROUP); insufficient-data reasons
 *    (RETENTION / CONSISTENCY) have no resolving screen, so they render without a link.
 *  - missing month target: only once the derived-target request finished and really
 *    returned none — never while it is in flight or has failed.
 *  - deadline: `remaining` is derived from the same detail fields RevenueTargetProgress
 *    already uses (target − actual), and the days left are calendar math on the period.
 *
 * Links only point at screens every role can reach (/targets, /my-territory — neither is
 * manager-only in navigation.config.ts). When nothing applies, the all-clear message
 * renders so the band never reads as a failed load.
 */

import Link from "next/link";
import {
  SCORED_METRIC_ORDER,
  formatKpiNumber,
} from "@/lib/kpiLabels";
import { formatMoney } from "@/lib/importLabels";
import {
  CompositeScoreResult,
  DerivedTarget,
  MetricResult,
  PeriodKey,
  ScoredKpiMetric,
  SupplementaryKpis,
} from "@/lib/types";

export interface ActionNeededBarProps {
  supplementary: SupplementaryKpis;
  composite: CompositeScoreResult;
  period: PeriodKey;
  /** The REVENUE_VS_TARGET result from the same payload — null when absent. */
  revenueMetric: MetricResult | null;
  /** The month's derived target (MONTH periods only). */
  derivedTarget: DerivedTarget | null;
  /** True while the derived-target request is in flight or has failed — the
   *  "ยังไม่มีเป้าของงวดนี้" item stays quiet rather than claiming a target is missing. */
  derivedUnavailable: boolean;
}

/** Metrics whose server-authored reasons are all target-config problems, so a
 *  non-computable result here is resolved on /targets. */
const TARGET_CONFIG_METRICS: ReadonlySet<ScoredKpiMetric> = new Set([
  "REVENUE_VS_TARGET",
  "NEW_CUSTOMERS",
  "PRODUCT_GROUP",
]);

const DEADLINE_DAYS_REMAINING = 7;

function endOfPeriod(period: PeriodKey): Date {
  if (period.periodType === "YEAR") return new Date(period.year, 11, 31, 23, 59, 59);
  const lastMonth =
    period.periodType === "QUARTER" ? period.periodNumber * 3 : period.periodNumber;
  // Day 0 of the following month = the period's last day.
  return new Date(period.year, lastMonth, 0, 23, 59, 59);
}

interface ActionItem {
  key: string;
  text: string;
  href?: string;
}

function collectActionItems({
  supplementary,
  composite,
  period,
  revenueMetric,
  derivedTarget,
  derivedUnavailable,
}: ActionNeededBarProps): ActionItem[] {
  const items: ActionItem[] = [];

  const churned = supplementary.churnedCustomers;
  if (churned.count > 0) {
    const worstMonths = churned.hospitals.reduce(
      (max, h) => Math.max(max, h.monthsSinceLastOrder),
      0
    );
    items.push({
      key: "churned",
      text:
        churned.hospitals.length > 0
          ? `ลูกค้า ${churned.count} แห่งไม่สั่งซื้อมาแล้ว ${formatKpiNumber(worstMonths)} เดือนขึ้นไป`
          : `ลูกค้า ${churned.count} แห่งไม่สั่งซื้อมาแล้วเกินเกณฑ์ที่กำหนด`,
      href: "/my-territory",
    });
  }

  const blocked = SCORED_METRIC_ORDER.map((metric) =>
    composite.metrics.find((result) => result.metric === metric)
  ).filter((result): result is MetricResult => !!result && !result.computable);
  if (blocked.length > 0) {
    const first = blocked[0];
    items.push({
      key: "blocked-criteria",
      text: `${blocked.length} เกณฑ์คำนวณไม่ได้${first.reason ? ` — ${first.reason}` : ""}`,
      href: TARGET_CONFIG_METRICS.has(first.metric) ? "/targets" : undefined,
    });
  }

  if (period.periodType === "MONTH" && !derivedUnavailable && derivedTarget === null) {
    items.push({ key: "missing-target", text: "ยังไม่มีเป้าของงวดนี้", href: "/targets" });
  }

  if (revenueMetric?.computable) {
    const actual = Number(revenueMetric.detail.actual ?? 0);
    const target = Number(revenueMetric.detail.target ?? 0);
    const achievementPercent = Number(revenueMetric.detail.achievementPercent ?? 0);
    const remaining = target - actual;
    const daysLeft = Math.ceil(
      (endOfPeriod(period).getTime() - Date.now()) / 86_400_000
    );
    if (achievementPercent < 100 && remaining > 0 && daysLeft >= 0 && daysLeft <= DEADLINE_DAYS_REMAINING) {
      items.push({
        key: "deadline",
        text: `เหลืออีก ${formatMoney(String(remaining))} บาทถึงเป้า (อีก ${daysLeft} วันสิ้นงวด)`,
        href: "/my-territory",
      });
    }
  }

  return items;
}

export function ActionNeededBar(props: ActionNeededBarProps) {
  const items = collectActionItems(props);

  return (
    <section
      aria-label="ต้องดำเนินการ"
      className="rounded-lg border border-amber-200 bg-amber-50/60 p-4"
    >
      <h2 className="text-sm font-semibold text-amber-900">ต้องดำเนินการ</h2>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          ไม่มีรายการที่ต้องดำเนินการในงวดนี้
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-amber-100">
          {items.map((item) => (
            <li key={item.key}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm text-[var(--text-primary)] hover:text-amber-900"
                >
                  <span>{item.text}</span>
                  <span aria-hidden className="shrink-0 font-medium text-amber-700">
                    →
                  </span>
                </Link>
              ) : (
                <div className="flex min-h-[44px] items-center gap-3 py-2 text-sm text-[var(--text-primary)]">
                  <span>{item.text}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ActionNeededBar;
