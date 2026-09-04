import { CutDealEntry } from "@/lib/types";
import { formatRatioPercent, formatTargetMoney } from "@/features/targets/utils/targetLabels";
import { Button } from "@/components/ui/button";

export interface CutDealsPanelProps {
  cutDeals: CutDealEntry[];
  /** Invoice numbers currently put back into THIS preview only. */
  reinstatedInvoiceNos: ReadonlySet<string>;
  /** invoiceNo being toggled while its POST /target-suggestions/reinstate-deal round-trips. */
  pendingInvoiceNo: string | null;
  onToggle: (invoiceNo: string) => void;
}

export function CutDealsPanel({ cutDeals, reinstatedInvoiceNos, pendingInvoiceNo, onToggle }: CutDealsPanelProps) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-xs">
      <header className="border-b border-border bg-surface-subtle/70 px-4 py-3">
        <h3 className="text-base font-semibold text-text-primary">ดีลที่ถูกตัดเป็น outlier</h3>
        <p className="mt-1 text-xs text-text-muted">
          เกณฑ์ตัดต่อใบกำกับ (ไม่มีการตัดเงียบ) · การเอากลับมีผลเฉพาะตัวอย่างการคำนวณนี้เท่านั้น
          จนกว่าจะกดรับข้อเสนอเข้าเป้าจริง
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3">เขต</th>
              <th className="px-4 py-3">เลขที่ใบกำกับ</th>
              <th className="px-4 py-3">มูลค่าดีล</th>
              <th className="px-4 py-3">สัดส่วน</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">
                <span className="sr-only">การจัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cutDeals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-muted">
                  ไม่มีดีลที่ถูกตัดในงวดนี้
                </td>
              </tr>
            )}
            {cutDeals.map((deal) => {
              const reinstated = reinstatedInvoiceNos.has(deal.invoiceNo);
              return (
                <tr key={deal.invoiceNo} className={reinstated ? "bg-success-subtle/40" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{deal.territoryName}</td>
                  <td className="px-4 py-3 font-mono text-text-primary">{deal.invoiceNo}</td>
                  <td className="px-4 py-3 text-text-secondary font-numeric">{formatTargetMoney(deal.dealValue)}</td>
                  <td className="px-4 py-3 text-text-secondary font-numeric">{formatRatioPercent(deal.ratio)}</td>
                  <td className="px-4 py-3">
                    {reinstated ? (
                      <span className="rounded-full bg-success-subtle border border-success/30 px-2 py-0.5 text-xs font-medium text-success">
                        เอากลับเข้าคำนวณแล้ว
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger-subtle border border-danger/30 px-2 py-0.5 text-xs font-medium text-danger">
                        ถูกตัดออกจากฐาน
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingInvoiceNo !== null}
                      onClick={() => onToggle(deal.invoiceNo)}
                      className="text-xs px-2.5 py-1"
                    >
                      {pendingInvoiceNo === deal.invoiceNo
                        ? "กำลังบันทึก..."
                        : reinstated
                          ? "ให้ถูกตัดตามเดิม"
                          : "เอากลับเข้าคำนวณ"}
                    </Button>
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

export default CutDealsPanel;
