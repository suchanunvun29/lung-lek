"use client";

import { useCallback, useEffect, useState } from "react";
import HospitalNameReviewTable from "@/components/nameReviews/HospitalNameReviewTable";
import SalesmanNameRuleTable from "@/components/nameReviews/SalesmanNameRuleTable";
import { decideHospitalNameReview, getErrorMessage, listHospitalNameReviews, listSalesmanNameRules, updateSalesmanNameRule } from "@/lib/api";
import { HospitalNameReview, SalesmanNameRule } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

type Tab = "hospitals" | "credits";

export default function NameReviewsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Tab>("hospitals");
  const [hospitalReviews, setHospitalReviews] = useState<HospitalNameReview[]>([]);
  const [salesmanRules, setSalesmanRules] = useState<SalesmanNameRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || user?.role !== "MANAGER") return;
    setLoading(true);
    try {
      const [reviewsData, rulesData] = await Promise.all([listHospitalNameReviews(token), listSalesmanNameRules(token)]);
      setHospitalReviews(reviewsData.hospitalNameReviews);
      setSalesmanRules(rulesData.salesmanNameRules);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "โหลดคิวการยืนยันชื่อไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => { void load(); }, [load]);

  if (user?.role !== "MANAGER") return <div className="mx-auto max-w-5xl p-4 sm:p-6"><h1 className="text-2xl font-semibold text-zinc-900">ยืนยันชื่อซ้ำ</h1><p className="mt-2 text-sm text-zinc-600">หน้านี้สำหรับผู้จัดการเท่านั้น</p></div>;

  async function handleHospitalDecision(review: HospitalNameReview, decision: "MERGED" | "KEPT_SEPARATE") {
    if (!token) return;
    setError(null);
    try {
      await decideHospitalNameReview(token, review.id, { decision });
      setHospitalReviews((reviews) => reviews.filter((item) => item.id !== review.id));
    } catch (actionError) { setError(getErrorMessage(actionError, "บันทึกการตัดสินใจไม่สำเร็จ")); }
  }

  async function handleRuleSave(rule: SalesmanNameRule, shares: number[]) {
    if (!token) return;
    setError(null);
    try {
      const result = await updateSalesmanNameRule(token, rule.id, rule.members.map((member, index) => ({ salespersonId: member.salespersonId, sharePercent: shares[index] })));
      setSalesmanRules((rules) => rules.map((item) => item.id === rule.id ? result.salesmanNameRule : item));
    } catch (actionError) { setError(getErrorMessage(actionError, "บันทึกสัดส่วนเครดิตไม่สำเร็จ")); }
  }

  return <div className="mx-auto max-w-5xl p-4 sm:p-6"><h1 className="text-2xl font-semibold text-zinc-900">ยืนยันชื่อซ้ำและเครดิตดีลร่วม</h1><p className="mt-1 text-sm text-zinc-600">การตัดสินใจจะใช้กับการนำเข้าครั้งถัดไปโดยอัตโนมัติ</p><div className="mt-4 flex gap-1 text-sm"><button type="button" onClick={() => setTab("hospitals")} className={`rounded px-3 py-1.5 font-medium ${tab === "hospitals" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>ชื่อโรงพยาบาล</button><button type="button" onClick={() => setTab("credits")} className={`rounded px-3 py-1.5 font-medium ${tab === "credits" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>เครดิตดีลร่วม</button></div>{loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}{!loading && <div className="mt-4">{tab === "hospitals" ? <HospitalNameReviewTable reviews={hospitalReviews} onDecide={handleHospitalDecision} /> : <SalesmanNameRuleTable rules={salesmanRules} onSave={handleRuleSave} />}</div>}</div>;
}
