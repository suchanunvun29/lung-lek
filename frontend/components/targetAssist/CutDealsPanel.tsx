import { CutDealEntry } from "@/lib/types";
import { formatRatioPercent, formatTargetMoney } from "@/lib/targetLabels";

interface CutDealsPanelProps {
  cutDeals: CutDealEntry[];
  /** Invoice numbers currently put back into THIS preview only. */
  reinstatedInvoiceNos: ReadonlySet<string>;
  /** invoiceNo being toggled while its POST /target-suggestions/reinstate-deal round-trips. */
  pendingInvoiceNo: string | null;
  onToggle: (invoiceNo: string) => void;
}

export default function CutDealsPanel({ cutDeals, reinstatedInvoiceNos, pendingInvoiceNo, onToggle }: CutDealsPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <h3 className="text-base font-semibold text-zinc-900">ดีลที่ถูกตัดเป็น outlier</h3>
        <p className="mt-1 text-sm text-zinc-600">
          เกณฑ์ตัดต่อใบกำกับ (ไม่มีการตัดเงียบ) · การเอากลับมีผลเฉพาะตัวอย่างการคำนวณนี้เท่านั้น
          จนกว่าจะกดรับข้อเสนอเข้าเป้าจริง
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">เขต</th>
              <th className="px-4 py-3">เลขที่ใบกำกับ</th>
              <th className="px-4 py-3">มูลค่าดีล</th>
              <th className="px-4 py-3">สัดส่วนต่อยอดรวมทุกภาค</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">
                <span className="sr-only">การจัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {cutDeals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                  ไม่มีดีลที่ถูกตัดในงวดนี้
                </td>
              </tr>
            )}
            {cutDeals.map((deal) => {
              const reinstated = reinstatedInvoiceNos.has(deal.invoiceNo);
              return (
                <tr key={deal.invoiceNo} className={reinstated ? "bg-emerald-50/60" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{deal.territoryName}</td>
                  <td className="px-4 py-3 font-mono text-zinc-900">{deal.invoiceNo}</td>
                  <td className="px-4 py-3 text-zinc-700">{formatTargetMoney(deal.dealValue)}</td>
                  <td className="px-4 py-3 text-zinc-700">{formatRatioPercent(deal.ratio)}</td>
                  <td className="px-4 py-3">
                    {reinstated ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        เอากลับเข้าคำนวณแล้ว (เฉพาะหน้านี้)
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        ถูกตัดออกจากฐาน
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={pendingInvoiceNo !== null}
                      onClick={() => onToggle(deal.invoiceNo)}
                      className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                        reinstated
                          ? "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                          : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      }`}
                    >
                      {pendingInvoiceNo === deal.invoiceNo
                        ? "กำลังบันทึก..."
                        : reinstated
                          ? "ให้ถูกตัดตามเดิม"
                          : "เอากลับเข้าคำนวณ"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
