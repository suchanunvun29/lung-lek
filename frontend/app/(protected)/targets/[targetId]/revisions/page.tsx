"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { getErrorMessage, listSalespeople, listTargetRevisions } from "@/lib/api";
import { fetchKnownProductTypes } from "@/lib/deriveProductTypes";
import { formatThaiMonth } from "@/lib/importLabels";
import {
  TARGET_CHANGE_TYPE_BADGE_CLASS,
  TARGET_CHANGE_TYPE_LABEL_TH,
  formatTargetMoney,
} from "@/lib/targetLabels";
import { EntitySummary, Salesperson, TargetProductGroupSnapshot, TargetRevision } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

interface TargetRevisionsPageProps {
  params: Promise<{ targetId: string }>;
}

export default function TargetRevisionsPage({ params }: TargetRevisionsPageProps) {
  const { targetId } = use(params);
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

  function renderProductGroups(groups: TargetProductGroupSnapshot[]) {
    if (groups.length === 0) return <span className="text-zinc-400">ไม่มี</span>;
    return (
      <ul className="space-y-0.5">
        {groups.map((g) => (
          <li key={g.productTypeId}>
            {productTypeNameById.get(g.productTypeId) ?? g.productTypeId}: {formatTargetMoney(g.revenueTarget)} บาท
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">
          ประวัติการแก้ไขเป้า
          {latest &&
            ` — ${salespersonNameById.get(latest.salespersonId) ?? latest.salespersonId} · ${formatThaiMonth(
              latest.month
            )} ${latest.year}`}
        </h1>
        <Link href="/targets" className="text-sm font-medium text-zinc-700 hover:underline">
          ← กลับไปหน้าตั้งเป้า
        </Link>
      </div>

      {loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}
      {loadError && <p className="mt-6 text-sm text-red-600">{loadError}</p>}

      {!loading && !loadError && revisions.length === 0 && (
        <p className="mt-6 text-zinc-400">ยังไม่มีประวัติการแก้ไข</p>
      )}

      <div className="mt-6 space-y-4">
        {revisions.map((rev) => (
          <div key={rev.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${TARGET_CHANGE_TYPE_BADGE_CLASS[rev.changeType]}`}>
                {TARGET_CHANGE_TYPE_LABEL_TH[rev.changeType]}
              </span>
              <span className="text-xs text-zinc-500">
                {rev.changedBy.displayName} · {new Date(rev.changedAt).toLocaleString("th-TH")}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="mb-1 font-medium text-zinc-500">ก่อนแก้</p>
                {rev.before ? (
                  <div className="space-y-1">
                    <p>ยอดขาย: {formatTargetMoney(rev.before.revenueTarget)} บาท</p>
                    <p>ลูกค้าใหม่: {rev.before.newCustomerTarget} ราย</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">เป้ากลุ่มสินค้า</p>
                    {renderProductGroups(rev.before.productGroupTargets)}
                  </div>
                ) : (
                  <p className="text-zinc-400">— ยังไม่มี —</p>
                )}
              </div>
              <div>
                <p className="mb-1 font-medium text-zinc-500">หลังแก้</p>
                {rev.after ? (
                  <div className="space-y-1">
                    <p>ยอดขาย: {formatTargetMoney(rev.after.revenueTarget)} บาท</p>
                    <p>ลูกค้าใหม่: {rev.after.newCustomerTarget} ราย</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">เป้ากลุ่มสินค้า</p>
                    {renderProductGroups(rev.after.productGroupTargets)}
                  </div>
                ) : (
                  <p className="text-zinc-400">— ถูกลบ —</p>
                )}
              </div>
            </div>

            {rev.note && <p className="mt-2 text-xs text-zinc-500">หมายเหตุ: {rev.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
