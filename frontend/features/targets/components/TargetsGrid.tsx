import { Salesperson, Target } from "@/lib/types";
import { formatThaiMonth } from "@/lib/importLabels";
import { TargetCell } from "./TargetCell";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function targetKey(salespersonId: string, month: number) {
  return `${salespersonId}-${month}`;
}

export interface TargetsGridProps {
  salespeople: Salesperson[];
  targetsByKey: Map<string, Target>;
  canEdit: boolean;
  savingKey: string | null;
  onSave: (
    salespersonId: string,
    month: number,
    input: { revenueTarget: number; newCustomerTarget: number }
  ) => Promise<boolean>;
  onOpenProductGroups: (target: Target) => void;
  onViewHistory: (target: Target) => void;
}

export function TargetsGrid({
  salespeople,
  targetsByKey,
  canEdit,
  savingKey,
  onSave,
  onOpenProductGroups,
  onViewHistory,
}: TargetsGridProps) {
  if (salespeople.length === 0) {
    return <p className="text-zinc-400">ยังไม่มีพนักงานขายในระบบ</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50">
            <th className="sticky left-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-600">
              พนักงานขาย
            </th>
            {MONTHS.map((month) => (
              <th key={month} className="border-b border-zinc-200 px-2 py-2 text-left font-medium text-zinc-600">
                {formatThaiMonth(month)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {salespeople.map((sp) => (
            <tr key={sp.id} className="border-b border-zinc-100 last:border-0">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-zinc-900">{sp.displayName}</td>
              {MONTHS.map((month) => {
                const key = targetKey(sp.id, month);
                const target = targetsByKey.get(key);
                return (
                  <td key={month} className="px-1 py-1 align-top">
                    <TargetCell
                      target={target}
                      canEdit={canEdit}
                      saving={savingKey === key}
                      onSave={(input) => onSave(sp.id, month, input)}
                      onOpenProductGroups={() => target && onOpenProductGroups(target)}
                      onViewHistory={() => target && onViewHistory(target)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TargetsGrid;
