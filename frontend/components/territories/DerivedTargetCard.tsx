import { DerivedTarget } from "@/lib/types";

const SOURCE_LABEL: Record<DerivedTarget["source"], string> = {
  PERSONAL: "กรอกเอง",
  TERRITORY: "คำนวณจากเขต",
  TERRITORY_GROUP: "คำนวณจากกลุ่มเขต",
};

export default function DerivedTargetCard({ target }: { target: DerivedTarget }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-900">เป้ารายคนที่คำนวณแล้ว</h2>
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{SOURCE_LABEL[target.source]}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-900">฿{Number(target.revenueTarget).toLocaleString("th-TH")}</p>
      <p className="text-sm text-zinc-600">เป้าลูกค้าใหม่ {target.newCustomerTarget.toLocaleString("th-TH")} ราย</p>
      {target.components.length > 0 && <ul className="mt-3 space-y-1 text-sm text-zinc-600">{target.components.map((item) => <li key={item.name}>{item.name}: ฿{Number(item.revenueTarget).toLocaleString("th-TH")} ÷ {item.activeOwnerCount} ผู้ดูแล</li>)}</ul>}
      {target.unownedTerritories.length > 0 && <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800"><p className="font-medium">เป้าของเขตที่ยังไม่มีผู้ดูแล</p>{target.unownedTerritories.map((item) => <p key={item.id}>{item.name}: ฿{Number(item.revenueTarget).toLocaleString("th-TH")}</p>)}</div>}
    </section>
  );
}
