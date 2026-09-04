"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { listTargetRevisions } from "@/features/targets/api/targets.api";
import { listSalespeople } from "@/features/master-data/api/master-data.api";
import { fetchKnownProductTypes } from "@/features/products/utils/deriveProductTypes";
import { formatThaiMonth } from "@/lib/importLabels";
import { formatTargetMoney } from "@/features/targets/utils/targetLabels";
import {
  EntitySummary,
  Salesperson,
  TargetProductGroupSnapshot,
  TargetRevision,
  TargetSnapshot,
} from "@/lib/types";
import { getErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Breadcrumb } from "@/components/shared/navigation/Breadcrumb";
import { StatusBadge } from "@/components/shared/status/StatusBadge";
import { EmptyState } from "@/components/shared/feedback/EmptyState";
import { InlineMessage } from "@/components/shared/feedback/InlineMessage";
import { SkeletonCard } from "@/components/shared/feedback/Skeleton";

interface TargetRevisionsPageProps {
  params: Promise<{ targetId: string }>;
}

interface FieldDiffItem {
  id: string;
  label: string;
  changed: boolean;
  beforeRender: ReactNode;
  afterRender: ReactNode;
}

function areProductGroupsEqual(
  beforeGroups: TargetProductGroupSnapshot[] = [],
  afterGroups: TargetProductGroupSnapshot[] = []
): boolean {
  if (beforeGroups.length !== afterGroups.length) return false;
  const beforeMap = new Map(beforeGroups.map((g) => [g.productTypeId, g.revenueTarget]));
  for (const ag of afterGroups) {
    if (!beforeMap.has(ag.productTypeId)) return false;
    if (beforeMap.get(ag.productTypeId) !== ag.revenueTarget) return false;
  }
  return true;
}

export default function TargetRevisionsPage({ params }: TargetRevisionsPageProps) {
  const { targetId: targetIdParam } = use(params);
  const targetId = Number(targetIdParam);
  const token = useAuthStore((state) => state.token);
  const [revisions, setRevisions] = useState<TargetRevision[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [productTypes, setProductTypes] = useState<EntitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [revisionsData, salespeopleData, productTypesData] = await Promise.all([
        listTargetRevisions(token, targetId),
        listSalespeople(token),
        fetchKnownProductTypes(token),
      ]);
      setRevisions(revisionsData.revisions);
      setSalespeople(salespeopleData.salespeople);
      setProductTypes(productTypesData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดประวัติการแก้ไขเป้าไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, targetId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const salespersonNameById = new Map(salespeople.map((sp) => [sp.id, sp.displayName]));
  const productTypeNameById = new Map(productTypes.map((pt) => [pt.id, pt.displayName]));
  const latest = revisions[0]?.after ?? revisions[revisions.length - 1]?.before ?? null;

  function renderProductGroups(
    groups: TargetProductGroupSnapshot[],
    otherGroups?: TargetProductGroupSnapshot[]
  ) {
    if (groups.length === 0) return <span className="text-text-muted text-xs">ไม่มีเป้ากลุ่มสินค้า</span>;
    const otherMap = otherGroups
      ? new Map(otherGroups.map((g) => [g.productTypeId, g.revenueTarget]))
      : null;

    return (
      <ul className="space-y-1">
        {groups.map((g) => {
          const changed = otherMap !== null && otherMap.get(g.productTypeId) !== g.revenueTarget;
          return (
            <li
              key={g.productTypeId}
              className={`text-xs flex items-center justify-between rounded px-1.5 py-0.5 ${
                changed ? "bg-amber-100/70 text-amber-950 font-medium" : "text-text-secondary"
              }`}
            >
              <span>{productTypeNameById.get(g.productTypeId) ?? `กลุ่ม #${g.productTypeId}`}</span>
              <span className="font-numeric">{formatTargetMoney(g.revenueTarget)} บาท</span>
            </li>
          );
        })}
      </ul>
    );
  }

  function getFieldDiffs(
    before: TargetSnapshot | null,
    after: TargetSnapshot | null,
    isCreate: boolean
  ): FieldDiffItem[] {
    if (isCreate || !before) {
      return [
        {
          id: "revenueTarget",
          label: "เป้ายอดขาย",
          changed: true,
          beforeRender: <span className="text-text-muted text-xs italic">สร้างใหม่ (ไม่มีข้อมูลก่อนหน้า)</span>,
          afterRender: (
            <span className="font-numeric text-xs font-semibold text-text-primary">
              {after ? `${formatTargetMoney(after.revenueTarget)} บาท` : "-"}
            </span>
          ),
        },
        {
          id: "newCustomerTarget",
          label: "เป้าลูกค้าใหม่",
          changed: true,
          beforeRender: <span className="text-text-muted text-xs italic">สร้างใหม่ (ไม่มีข้อมูลก่อนหน้า)</span>,
          afterRender: (
            <span className="font-numeric text-xs font-semibold text-text-primary">
              {after ? `${after.newCustomerTarget} ราย` : "-"}
            </span>
          ),
        },
        {
          id: "productGroupTargets",
          label: "เป้ากลุ่มสินค้า",
          changed: Boolean(after && after.productGroupTargets?.length > 0),
          beforeRender: <span className="text-text-muted text-xs italic">สร้างใหม่ (ไม่มีข้อมูลก่อนหน้า)</span>,
          afterRender: after ? renderProductGroups(after.productGroupTargets) : "-",
        },
        {
          id: "note",
          label: "หมายเหตุเป้าหมาย",
          changed: Boolean(after?.note),
          beforeRender: <span className="text-text-muted text-xs italic">—</span>,
          afterRender: <span className="text-xs text-text-secondary">{after?.note || "—"}</span>,
        },
      ];
    }

    const revenueChanged = before.revenueTarget !== after?.revenueTarget;
    const newCustomerChanged = before.newCustomerTarget !== after?.newCustomerTarget;
    const productGroupsChanged = !areProductGroupsEqual(
      before.productGroupTargets,
      after?.productGroupTargets
    );
    const noteChanged = (before.note ?? "") !== (after?.note ?? "");

    return [
      {
        id: "revenueTarget",
        label: "เป้ายอดขาย",
        changed: revenueChanged,
        beforeRender: (
          <span className="font-numeric text-xs text-text-secondary">
            {formatTargetMoney(before.revenueTarget)} บาท
          </span>
        ),
        afterRender: (
          <span
            className={`font-numeric text-xs ${
              revenueChanged ? "font-semibold text-amber-900 bg-amber-100/80 px-1 py-0.5 rounded" : "text-text-secondary"
            }`}
          >
            {after ? `${formatTargetMoney(after.revenueTarget)} บาท` : "— ถูกลบ —"}
          </span>
        ),
      },
      {
        id: "newCustomerTarget",
        label: "เป้าลูกค้าใหม่",
        changed: newCustomerChanged,
        beforeRender: (
          <span className="font-numeric text-xs text-text-secondary">
            {before.newCustomerTarget} ราย
          </span>
        ),
        afterRender: (
          <span
            className={`font-numeric text-xs ${
              newCustomerChanged ? "font-semibold text-amber-900 bg-amber-100/80 px-1 py-0.5 rounded" : "text-text-secondary"
            }`}
          >
            {after ? `${after.newCustomerTarget} ราย` : "— ถูกลบ —"}
          </span>
        ),
      },
      {
        id: "productGroupTargets",
        label: "เป้ากลุ่มสินค้า",
        changed: productGroupsChanged,
        beforeRender: renderProductGroups(before.productGroupTargets, after?.productGroupTargets),
        afterRender: after
          ? renderProductGroups(after.productGroupTargets, before.productGroupTargets)
          : <span className="text-xs text-text-muted">— ถูกลบ —</span>,
      },
      {
        id: "note",
        label: "หมายเหตุเป้าหมาย",
        changed: noteChanged,
        beforeRender: <span className="text-xs text-text-secondary">{before.note || "—"}</span>,
        afterRender: (
          <span
            className={`text-xs ${
              noteChanged ? "font-medium text-amber-900 bg-amber-100/80 px-1 py-0.5 rounded" : "text-text-secondary"
            }`}
          >
            {after?.note || "—"}
          </span>
        ),
      },
    ];
  }

  const salespersonLabel = latest
    ? salespersonNameById.get(latest.salespersonId) ?? `พนักงาน #${latest.salespersonId}`
    : `เป้า #${targetId}`;
  const periodLabel = latest ? `${formatThaiMonth(latest.month)} ${latest.year}` : "";

  return (
    <PageContainer width="standard">
      {/* Pattern C: Breadcrumb override with target owner and period */}
      <div className="mb-4">
        <Breadcrumb
          segments={[
            { label: "เป้าหมาย" },
            { label: "เป้ารายบุคคล", href: "/targets" },
            {
              label: latest
                ? `ประวัติการแก้เป้า: ${salespersonLabel} (${periodLabel})`
                : `ประวัติการแก้เป้า #${targetId}`,
            },
          ]}
        />
      </div>

      <PageHeader
        title="ประวัติการแก้ไขเป้า"
        description={latest ? `${salespersonLabel} · งวด ${periodLabel}` : `รหัสเป้าหมาย #${targetId}`}
        secondaryActions={[
          <Link
            key="back"
            href="/targets"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับไปหน้าตั้งเป้า
          </Link>,
        ]}
      />

      {loadError && (
        <div className="mb-6">
          <InlineMessage variant="destructive">{loadError}</InlineMessage>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && !loadError && revisions.length === 0 && (
        <EmptyState
          title="ยังไม่มีประวัติการแก้ไข"
          description="เป้าหมายนี้ยังไม่มีบันทึกประวัติการปรับปรุงตัวเลขในระบบ"
        />
      )}

      {!loading && revisions.length > 0 && (
        <div className="space-y-6">
          {revisions.map((rev) => {
            const isCreate = rev.changeType === "CREATE" || !rev.before;
            const fieldDiffs = getFieldDiffs(rev.before, rev.after, isCreate);
            const mobileFields = [...fieldDiffs].sort(
              (a, b) => (b.changed ? 1 : 0) - (a.changed ? 1 : 0)
            );

            const revenueChanged = rev.before && rev.after && rev.before.revenueTarget !== rev.after.revenueTarget;
            const newCustomerChanged = rev.before && rev.after && rev.before.newCustomerTarget !== rev.after.newCustomerTarget;
            const productGroupsChanged = rev.before && rev.after && !areProductGroupsEqual(rev.before.productGroupTargets, rev.after.productGroupTargets);
            const noteChanged = rev.before && rev.after && (rev.before.note ?? "") !== (rev.after.note ?? "");

            return (
              <div
                key={rev.id}
                className="rounded-lg border border-border bg-surface shadow-xs overflow-hidden"
              >
                {/* Revision Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-subtle/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={{ type: "targetChangeType", value: rev.changeType }} />
                    <span className="text-xs font-semibold text-text-primary">
                      ฉบับที่ #{rev.id}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
                    ผู้แก้ไข: <span className="font-medium text-text-secondary">{rev.changedBy.displayName}</span> ·{" "}
                    {new Date(rev.changedAt).toLocaleString("th-TH")}
                  </span>
                </div>

                <div className="p-4">
                  {/* Desktop / Tablet: Two aligned columns */}
                  <div className="hidden sm:grid sm:grid-cols-2 sm:gap-6">
                    {/* Before column */}
                    <div className="rounded-md border border-border/80 bg-surface-subtle/20 p-3.5">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                          ก่อนแก้ (Before)
                        </span>
                        {isCreate && (
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-muted border border-border">
                            สร้างใหม่
                          </span>
                        )}
                      </div>

                      {rev.before ? (
                        <div className="space-y-3">
                          <div className={`rounded p-2 transition-colors ${revenueChanged ? "border border-amber-200 bg-amber-50/60" : ""}`}>
                            <span className="text-[11px] font-medium text-text-muted block">ยอดขาย</span>
                            <span className="font-numeric text-sm font-medium text-text-primary">
                              {formatTargetMoney(rev.before.revenueTarget)} บาท
                            </span>
                          </div>

                          <div className={`rounded p-2 transition-colors ${newCustomerChanged ? "border border-amber-200 bg-amber-50/60" : ""}`}>
                            <span className="text-[11px] font-medium text-text-muted block">ลูกค้าใหม่</span>
                            <span className="font-numeric text-sm font-medium text-text-primary">
                              {rev.before.newCustomerTarget} ราย
                            </span>
                          </div>

                          <div className={`rounded p-2 transition-colors ${productGroupsChanged ? "border border-amber-200 bg-amber-50/60" : ""}`}>
                            <span className="text-[11px] font-medium text-text-muted block mb-1">เป้ากลุ่มสินค้า</span>
                            {renderProductGroups(rev.before.productGroupTargets, rev.after?.productGroupTargets)}
                          </div>

                          {rev.before.note && (
                            <div className={`rounded p-2 transition-colors ${noteChanged ? "border border-amber-200 bg-amber-50/60" : ""}`}>
                              <span className="text-[11px] font-medium text-text-muted block">หมายเหตุ</span>
                              <span className="text-xs text-text-secondary">{rev.before.note}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-text-muted">
                          <span className="font-medium text-text-secondary mb-1">สร้างใหม่</span>
                          <span>ไม่มีข้อมูลเป้าหมายก่อนหน้าสำหรับรายการนี้</span>
                        </div>
                      )}
                    </div>

                    {/* After column */}
                    <div className="rounded-md border border-border/80 bg-surface-subtle/20 p-3.5">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                          หลังแก้ (After)
                        </span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-secondary border border-border">
                          {isCreate ? "ค่าแรกเริ่ม" : "ค่าที่บันทึก"}
                        </span>
                      </div>

                      {rev.after ? (
                        <div className="space-y-3">
                          <div
                            className={`rounded p-2 transition-colors ${
                              isCreate || revenueChanged
                                ? "border border-amber-300 bg-amber-50/80"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-text-muted block">ยอดขาย</span>
                              {(isCreate || revenueChanged) && (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
                                  {isCreate ? "เริ่มต้น" : "เปลี่ยน"}
                                </span>
                              )}
                            </div>
                            <span className="font-numeric text-sm font-semibold text-text-primary">
                              {formatTargetMoney(rev.after.revenueTarget)} บาท
                            </span>
                          </div>

                          <div
                            className={`rounded p-2 transition-colors ${
                              isCreate || newCustomerChanged
                                ? "border border-amber-300 bg-amber-50/80"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-text-muted block">ลูกค้าใหม่</span>
                              {(isCreate || newCustomerChanged) && (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
                                  {isCreate ? "เริ่มต้น" : "เปลี่ยน"}
                                </span>
                              )}
                            </div>
                            <span className="font-numeric text-sm font-semibold text-text-primary">
                              {rev.after.newCustomerTarget} ราย
                            </span>
                          </div>

                          <div
                            className={`rounded p-2 transition-colors ${
                              isCreate || productGroupsChanged
                                ? "border border-amber-300 bg-amber-50/80"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-medium text-text-muted block">เป้ากลุ่มสินค้า</span>
                              {(isCreate || productGroupsChanged) && (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
                                  {isCreate ? "เริ่มต้น" : "เปลี่ยน"}
                                </span>
                              )}
                            </div>
                            {renderProductGroups(rev.after.productGroupTargets, rev.before?.productGroupTargets)}
                          </div>

                          {rev.after.note && (
                            <div
                              className={`rounded p-2 transition-colors ${
                                isCreate || noteChanged
                                  ? "border border-amber-300 bg-amber-50/80"
                                  : ""
                              }`}
                            >
                              <span className="text-[11px] font-medium text-text-muted block">หมายเหตุ</span>
                              <span className="text-xs text-text-primary">{rev.after.note}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-danger">
                          <span className="font-medium">— ถูกลบ —</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile: Stacked before/after per field, changed fields sorted first */}
                  <div className="sm:hidden space-y-2.5">
                    <p className="text-[11px] text-text-muted">
                      แสดงรายการเปรียบเทียบ (ฟิลด์ที่มีการเปลี่ยนแปลงแสดงขึ้นก่อน):
                    </p>
                    {mobileFields.map((field) => (
                      <div
                        key={field.id}
                        className={`rounded-md border p-2.5 ${
                          field.changed
                            ? "border-amber-300 bg-amber-50/50"
                            : "border-border bg-surface-subtle/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-text-primary">{field.label}</span>
                          {field.changed && (
                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              {isCreate ? "สร้างใหม่" : "เปลี่ยนแปลง"}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="border-r border-border/50 pr-2">
                            <span className="text-[10px] text-text-muted block mb-0.5">ก่อนแก้</span>
                            <div>{field.beforeRender}</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-text-muted block mb-0.5">หลังแก้</span>
                            <div>{field.afterRender}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Audit note if provided */}
                  {rev.note && (
                    <div className="mt-3 border-t border-border pt-2 text-xs text-text-muted">
                      <span className="font-medium text-text-secondary">หมายเหตุการแก้ไข:</span> {rev.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
