"use client";

/**
 * /name-reviews — WACC-P1-009
 *
 * Pattern E: PageHeader → outstanding-count summary → Tabs (one per queue, with
 * its count) → decidable rows on DataTable → ConfirmDialog.
 *
 * Destructive decisions are gated: MERGED (both queues) deletes a record
 * server-side and is final, so it goes through ConfirmDialog naming which
 * record merges into which and stating that the merge affects future imports.
 * KEPT_SEPARATE deletes nothing and stays a single click.
 *
 * The decision payload and endpoints are unchanged. A row is removed from the
 * queue only after the request succeeds — a failed request keeps the row and
 * surfaces the translated error, so the UI never claims a decision that did
 * not happen.
 */

import { useEffect, useState } from "react";
import {
  HospitalNameReviewTable,
  SalesmanNameReviewTable,
  SalesmanNameRuleTable,
  decideHospitalNameReview,
  decideSalesmanNameReview,
  listHospitalNameReviews,
  listSalesmanNameReviews,
  listSalesmanNameRules,
  updateSalesmanNameRule,
} from "@/features/name-reviews";
import { listSalespeople } from "@/features/master-data";
import { getErrorMessage } from "@/lib/api-client";
import { HospitalNameReview, SalesmanNameReview, SalesmanNameRule } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { refreshQueueCounts } from "@/components/shared/navigation/useQueueCounts";
import { ForbiddenState } from "@/components/shared/auth/ForbiddenState";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { InlineMessage } from "@/components/shared/feedback/InlineMessage";
import { ConfirmDialog } from "@/components/shared/feedback/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Tab = "hospitals" | "credits" | "salesmen";

/** A MERGED decision waiting for confirmation. */
interface PendingMerge {
  kind: "hospital" | "salesman";
  hospitalReview?: HospitalNameReview;
  salesmanReview?: SalesmanNameReview;
  mergedInto?: { id: number; displayName: string };
}

export default function NameReviewsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Tab>("hospitals");
  const [hospitalReviews, setHospitalReviews] = useState<HospitalNameReview[]>([]);
  const [salesmanRules, setSalesmanRules] = useState<SalesmanNameRule[]>([]);
  const [salesmanReviews, setSalesmanReviews] = useState<SalesmanNameReview[]>([]);
  const [mergeTargets, setMergeTargets] = useState<{ id: number; displayName: string }[]>([]);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || user?.role !== "MANAGER") return;
    let ignore = false;
    Promise.all([listHospitalNameReviews(token), listSalesmanNameRules(token), listSalesmanNameReviews(token), listSalespeople(token)])
      .then(([reviewsData, rulesData, salesmanReviewsData, salespeopleData]) => {
        if (ignore) return;
        setHospitalReviews(reviewsData.hospitalNameReviews);
        setSalesmanRules(rulesData.salesmanNameRules);
        setSalesmanReviews(salesmanReviewsData.salesmanNameReviews);
        setMergeTargets(salespeopleData.salespeople.map((sp) => ({ id: sp.id, displayName: sp.displayName })));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!ignore) setError(getErrorMessage(loadError, "โหลดคิวการยืนยันชื่อไม่สำเร็จ"));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token, user?.role]);

  if (user?.role !== "MANAGER") {
    return <ForbiddenState reason="หน้านี้สำหรับผู้จัดการเท่านั้น" />;
  }

  async function handleHospitalDecision(review: HospitalNameReview, decision: "MERGED" | "KEPT_SEPARATE") {
    if (!token) return;
    setError(null);
    try {
      await decideHospitalNameReview(token, review.id, { decision });
      // Remove only after success — a failure keeps the row in the queue.
      setHospitalReviews((reviews) => reviews.filter((item) => item.id !== review.id));
      void refreshQueueCounts(token);
    } catch (actionError) {
      setError(getErrorMessage(actionError, "บันทึกการตัดสินใจไม่สำเร็จ — รายการยังอยู่ในคิวเดิม"));
    }
  }

  async function handleRuleSave(rule: SalesmanNameRule, shares: number[]) {
    if (!token) return;
    setError(null);
    try {
      const result = await updateSalesmanNameRule(token, rule.id, rule.members.map((member, index) => ({ salespersonId: member.salespersonId, sharePercent: shares[index] })));
      setSalesmanRules((rules) => rules.map((item) => item.id === rule.id ? result.salesmanNameRule : item));
    } catch (actionError) {
      setError(getErrorMessage(actionError, "บันทึกสัดส่วนเครดิตไม่สำเร็จ"));
    }
  }

  async function handleSalesmanReviewDecision(review: SalesmanNameReview, decision: { decision: "MERGED"; mergedIntoId: number } | { decision: "KEPT_SEPARATE" }) {
    if (!token) return;
    setError(null);
    try {
      await decideSalesmanNameReview(token, review.id, decision);
      // MERGED deletes the duplicate person server-side; KEPT_SEPARATE keeps
      // everything as-is. Either way the decision is final — remove only after
      // the request resolves so a failure restores (never removed) the row.
      setSalesmanReviews((reviews) => reviews.filter((item) => item.id !== review.id));
      void refreshQueueCounts(token);
    } catch (actionError) {
      setError(getErrorMessage(actionError, "บันทึกการตัดสินใจไม่สำเร็จ — รายการยังอยู่ในคิวเดิม"));
    }
  }

  async function handleSalesmanKeepSeparate(review: SalesmanNameReview) {
    await handleSalesmanReviewDecision(review, { decision: "KEPT_SEPARATE" });
  }

  async function handleSalesmanMerge(review: SalesmanNameReview, mergedIntoId: number) {
    await handleSalesmanReviewDecision(review, { decision: "MERGED", mergedIntoId });
  }

  async function confirmPendingMerge() {
    if (!pendingMerge) return;
    setConfirming(true);
    try {
      if (pendingMerge.kind === "hospital" && pendingMerge.hospitalReview) {
        await handleHospitalDecision(pendingMerge.hospitalReview, "MERGED");
      } else if (pendingMerge.kind === "salesman" && pendingMerge.salesmanReview && pendingMerge.mergedInto) {
        await handleSalesmanReviewDecision(pendingMerge.salesmanReview, {
          decision: "MERGED",
          mergedIntoId: pendingMerge.mergedInto.id,
        });
      }
      setPendingMerge(null);
    } finally {
      setConfirming(false);
    }
  }

  const outstandingCount = hospitalReviews.length + salesmanReviews.length;

  function mergeDialogText(pending: PendingMerge): { title: string; description: string } {
    if (pending.kind === "hospital" && pending.hospitalReview) {
      return {
        title: "ยืนยันการรวมชื่อโรงพยาบาล",
        description: `ระบบจะรวม "${pending.hospitalReview.sampleRawA}" และ "${pending.hospitalReview.sampleRawB}" เข้าเป็นชื่อเดียวกัน`,
      };
    }
    const review = pending.salesmanReview;
    const target = pending.mergedInto;
    return {
      title: "ยืนยันการรวมพนักงานขาย",
      description: review && target
        ? `ระบบจะย้ายดีลและเครดิตทั้งหมดของ "${review.createdSalesperson?.displayName ?? review.sampleRaw}" เข้าไปที่ "${target.displayName}" แล้วลบพนักงานขายที่ถูกสร้างซ้ำทิ้ง`
        : "",
    };
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        title="ยืนยันชื่อซ้ำและเครดิตดีลร่วม"
        description="การตัดสินใจจะใช้กับการนำเข้าครั้งถัดไปโดยอัตโนมัติ"
        meta={
          outstandingCount > 0
            ? `ค้างยืนยันทั้งหมด ${outstandingCount.toLocaleString("th-TH")} รายการ`
            : "ไม่มีรายการค้างยืนยัน"
        }
      />

      {error && (
        <div className="mb-4">
          <InlineMessage variant="destructive">{error}</InlineMessage>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-text-muted">กำลังโหลด...</p>
      ) : (
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <div className="overflow-x-auto">
          <TabsList className="max-w-full">
            <TabsTrigger value="hospitals">
              ชื่อโรงพยาบาล{hospitalReviews.length > 0 ? ` (${hospitalReviews.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="credits">
              เครดิตดีลร่วม{salesmanRules.length > 0 ? ` (${salesmanRules.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="salesmen">
              พนักงานขาย{salesmanReviews.length > 0 ? ` (${salesmanReviews.length})` : ""}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="hospitals" className="mt-4">
          <HospitalNameReviewTable
            reviews={hospitalReviews}
            onDecide={handleHospitalDecision}
            onRequestMerge={(review) => setPendingMerge({ kind: "hospital", hospitalReview: review })}
          />
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <p className="mb-3 text-sm text-text-secondary">
            กติกาแบ่งเครดิตใช้กับดีลที่มีพนักงานขายร่วมกัน — สัดส่วนรวมต้องเท่ากับ 100%
          </p>
          <SalesmanNameRuleTable rules={salesmanRules} onSave={handleRuleSave} />
        </TabsContent>

        <TabsContent value="salesmen" className="mt-4">
          <p className="mb-3 text-sm text-text-secondary">
            การ “รวม” จะย้ายดีล/เครดิตทั้งหมดไปยังคนเป้าหมายแล้วลบแถวที่ถูกสร้างซ้ำ — ตัดสินแล้วจะไม่ถามซ้ำ
          </p>
          <SalesmanNameReviewTable
            reviews={salesmanReviews}
            mergeTargets={mergeTargets}
            onDecide={handleSalesmanKeepSeparate}
            onRequestMerge={handleSalesmanMerge}
          />
        </TabsContent>
      </Tabs>
      )}

      {pendingMerge && (
        <ConfirmDialog
          title={mergeDialogText(pendingMerge).title}
          description={mergeDialogText(pendingMerge).description}
          consequence="การรวมเป็นการตัดสินใจถาวร ย้อนกลับไม่ได้ และระบบจะใช้การตัดสินใจนี้กับการนำเข้าข้อมูลครั้งถัดไปโดยอัตโนมัติ"
          confirmLabel="ยืนยันการรวม"
          tone="danger"
          pending={confirming}
          onConfirm={() => confirmPendingMerge()}
          onCancel={() => setPendingMerge(null)}
        />
      )}
    </div>
  );
}
