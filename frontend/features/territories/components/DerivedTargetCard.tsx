import { DerivedTarget, DerivedTargetContribution } from "@/lib/types";
import { Card } from "@/components/ui/card";

export interface DerivedTargetCardProps {
  target: DerivedTarget;
}

const SOURCE_LABEL: Record<DerivedTarget["source"], string> = {
  MANUAL: "กรอกเอง",
  TERRITORY: "คำนวณจากเขต",
  TERRITORY_GROUP: "คำนวณจากกลุ่มเขต",
};

// The derived payload carries only territory/territoryGroupId — no display names.
function contributionLabel(item: DerivedTargetContribution) {
  const id = item.territoryId ?? item.territoryGroupId ?? "";
  return `${item.territoryId ? "เขต" : "กลุ่มเขต"} ${id}`;
}

function ContributionList({ items }: { items: DerivedTargetContribution[] }) {
  return (
    <ul className="space-y-1 text-sm text-zinc-600">
      {items.map((item) => (
        <li key={item.territoryId ?? item.territoryGroupId}>
          {contributionLabel(item)}: ฿{item.revenueTarget.toLocaleString("th-TH")}
        </li>
      ))}
    </ul>
  );
}

export function DerivedTargetCard({ target }: DerivedTargetCardProps) {
  const owned = target.items.filter((item) => !item.unassigned);
  const unowned = target.items.filter((item) => item.unassigned);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-900">เป้ารายคนที่คำนวณแล้ว</h2>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{SOURCE_LABEL[target.source]}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-900">฿{target.revenueTarget.toLocaleString("th-TH")}</p>
      <p className="text-sm text-zinc-600">เป้าลูกค้าใหม่ {target.newCustomerTarget.toLocaleString("th-TH")} ราย</p>
      {owned.length > 0 && <div className="mt-3"><ContributionList items={owned} /></div>}
      {unowned.length > 0 && (
        <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">เป้าของเขตที่ยังไม่มีผู้ดูแล</p>
          <div className="mt-1"><ContributionList items={unowned} /></div>
        </div>
      )}
    </Card>
  );
}

export default DerivedTargetCard;
