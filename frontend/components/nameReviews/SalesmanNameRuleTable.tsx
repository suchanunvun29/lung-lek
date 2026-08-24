"use client";

import { useState } from "react";
import { SalesmanNameRule } from "@/lib/types";

const SHARE_PERCENT_TOTAL = 100;
const SHARE_PERCENT_EPSILON = 0.001;

interface SalesmanNameRuleTableProps {
  rules: SalesmanNameRule[];
  onSave: (rule: SalesmanNameRule, shares: number[]) => Promise<void>;
}

export default function SalesmanNameRuleTable({ rules, onSave }: SalesmanNameRuleTableProps) {
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [draftsSource, setDraftsSource] = useState(rules);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (rules !== draftsSource) {
    setDraftsSource(rules);
    setDrafts(Object.fromEntries(rules.map((rule) => [rule.id, rule.members.map((member) => member.sharePercent)])));
  }

  function updateDraft(ruleId: string, index: number, value: string) {
    setDrafts((previous) => ({ ...previous, [ruleId]: previous[ruleId].map((share, currentIndex) => currentIndex === index ? value : share) }));
  }

  function getTotal(rule: SalesmanNameRule) {
    return (drafts[rule.id] ?? []).reduce((sum, value) => sum + Number(value), 0);
  }

  async function handleSave(rule: SalesmanNameRule) {
    const shares = (drafts[rule.id] ?? []).map(Number);
    setBusyId(rule.id);
    try {
      await onSave(rule, shares);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {rules.length === 0 && <p className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">ยังไม่มีกฎแบ่งเครดิตดีลร่วม</p>}
      {rules.map((rule) => {
        const total = getTotal(rule);
        const validTotal = Math.abs(total - SHARE_PERCENT_TOTAL) <= SHARE_PERCENT_EPSILON;
        return (
          <section key={rule.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="font-medium text-zinc-900">{rule.sampleRaw}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500"><tr><th className="pb-2">พนักงานขาย</th><th className="pb-2">สัดส่วนเครดิต (%)</th></tr></thead>
                <tbody>
                  {rule.members.map((member, index) => (
                    <tr key={member.id}>
                      <td className="py-2 text-zinc-800">{member.salesperson.displayName}</td>
                      <td className="py-2"><input aria-label={`สัดส่วนเครดิต ${member.salesperson.displayName}`} type="number" min="0.001" max="100" step="0.001" value={drafts[rule.id]?.[index] ?? ""} onChange={(event) => updateDraft(rule.id, index, event.target.value)} className="w-28 rounded border border-zinc-300 px-2 py-1.5" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`text-sm font-medium ${validTotal ? "text-emerald-700" : "text-red-600"}`}>รวม {total.toFixed(3)}% {validTotal ? "" : "(ต้องเท่ากับ 100%)"}</span>
              <button type="button" disabled={!validTotal || busyId === rule.id} onClick={() => void handleSave(rule)} className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50">บันทึกสัดส่วน</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
