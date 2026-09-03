import { SalesLine } from "@/lib/types";
import { formatMoney } from "@/lib/importLabels";

export interface SalesLinesTableProps {
  salesLines: SalesLine[];
  loading: boolean;
}

export function SalesLinesTable({ salesLines, loading }: SalesLinesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">วันที่ใบแจ้งหนี้</th>
            <th className="px-4 py-3">เลขที่ใบแจ้งหนี้</th>
            <th className="px-4 py-3">โรงพยาบาล</th>
            <th className="px-4 py-3">พนักงานขาย</th>
            <th className="px-4 py-3">สินค้า</th>
            <th className="px-4 py-3">กลุ่มสินค้า</th>
            <th className="px-4 py-3 text-right">จำนวน</th>
            <th className="px-4 py-3 text-right">ยอดรวม (Total)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                กำลังโหลด...
              </td>
            </tr>
          )}
          {!loading && salesLines.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                ไม่พบข้อมูลตามเงื่อนไขที่เลือก
              </td>
            </tr>
          )}
          {salesLines.map((line) => (
            <tr key={line.id}>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                {new Date(line.invoiceDate).toLocaleDateString("th-TH")}
              </td>
              <td className="px-4 py-3 text-zinc-600">{line.invoiceNo}</td>
              <td className="px-4 py-3 text-zinc-900">{line.hospital.displayName}</td>
              <td className="px-4 py-3 text-zinc-900">{line.salesperson.displayName}</td>
              <td className="px-4 py-3 text-zinc-600">{line.product.name}</td>
              <td className="px-4 py-3 text-zinc-600">{line.productType.name}</td>
              <td className="px-4 py-3 text-right text-zinc-600">{line.qty}</td>
              <td className="px-4 py-3 text-right font-medium text-zinc-900">{formatMoney(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SalesLinesTable;
