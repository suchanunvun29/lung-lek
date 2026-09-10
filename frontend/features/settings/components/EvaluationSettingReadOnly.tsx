import { EvaluationSetting } from "@/lib/types";
import { POTENTIAL_METRIC_LABEL_TH } from "@/lib/targetLabels";
import { Card } from "@/components/ui/card";
import { BarChart3, Bot, Compass, Target } from "lucide-react";

export interface EvaluationSettingReadOnlyProps {
  setting: EvaluationSetting;
}

function formatDecimal(value: string | number): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("th-TH", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : String(value);
}

export function EvaluationSettingReadOnly({ setting }: EvaluationSettingReadOnlyProps) {
  return (
    <div className="space-y-6">
      {/* กลุ่มที่ 1: การประเมิน */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <BarChart3 size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            การประเมิน
          </h2>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="churnMonths" className="text-xs text-[var(--text-muted)]">
              จำนวนเดือนที่ไม่สั่งซื้อถือว่าหยุดเป็นลูกค้า
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {setting.churnMonths} เดือน
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              กระทบเกณฑ์ Retention เมื่อลูกค้าไม่สั่งซื้อติดต่อกันเกินช่วงเวลานี้
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="minMonthsForChurn" className="text-xs text-[var(--text-muted)]">
              จำนวนเดือนขั้นต่ำสำหรับวัดการรักษาลูกค้า
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {setting.minMonthsForChurn} เดือน
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ต้องมีประวัติครบอย่างน้อยตามเกณฑ์จึงจะสามารถคำนวณคะแนน Retention ได้
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)] md:col-span-2">
            <dt title="minMonthsForConsistency" className="text-xs text-[var(--text-muted)]">
              จำนวนเดือนขั้นต่ำสำหรับวัดความสม่ำเสมอ
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {setting.minMonthsForConsistency} เดือน
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ต้องมีประวัติครบอย่างน้อยตามเกณฑ์จึงจะสามารถคำนวณคะแนน Consistency ได้
            </p>
          </div>
        </dl>
      </Card>

      {/* กลุ่มที่ 2: AI */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <Bot size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            AI
          </h2>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="aiEnabled" className="text-xs text-[var(--text-muted)]">
              วิเคราะห์จุดแข็งและโอกาสพัฒนาด้วย AI
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {setting.aiEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              สร้างบทวิเคราะห์อัตโนมัติบนหน้ารายงานผลงานพนักงานขาย
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="aiAnonymize" className="text-xs text-[var(--text-muted)]">
              ปิดบังข้อมูลระบุตัวบุคคลก่อนส่ง AI
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {setting.aiAnonymize ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ปิดบังชื่อพนักงานและโรงพยาบาลก่อนส่งโมเดลภายนอก (ตาม Business Rule I)
            </p>
          </div>
        </dl>
      </Card>

      {/* กลุ่มที่ 3: ศักยภาพ */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <Compass size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            ศักยภาพ
          </h2>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="potentialMetric" className="text-xs text-[var(--text-muted)]">
              ตัวชี้วัดหลักสำหรับประเมินศักยภาพ
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {POTENTIAL_METRIC_LABEL_TH[setting.potentialMetric]}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ตัวชี้วัดจากทะเบียนโรงพยาบาลที่ใช้ถ่วงน้ำหนักศักยภาพเขต
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="minRegionCoverage" className="text-xs text-[var(--text-muted)]">
              สัดส่วนข้อมูลขั้นต่ำของภาค
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1 tabular-nums">
              {formatDecimal(setting.minRegionCoverage)}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              สัดส่วนข้อมูลที่ต้องมีครบก่อนนำศักยภาพไปใช้ปรับเป้าหมายใน Target Assist
            </p>
          </div>
        </dl>
      </Card>

      {/* กลุ่มที่ 4: ตัวช่วยตั้งเป้า */}
      <Card className="p-5">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3 mb-4">
          <Target size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-base text-[var(--text-primary)]">
            ตัวช่วยตั้งเป้า
          </h2>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="targetSuggestionAlpha" className="text-xs text-[var(--text-muted)]">
              สัดส่วนประวัติยอดขายที่ใช้เสนอเป้า
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1 tabular-nums">
              {formatDecimal(setting.targetSuggestionAlpha)}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              1.000 หมายถึงเสนอเป้าจากประวัติยอดขาย 100% ใน Target Assist
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="targetLookbackMonths" className="text-xs text-[var(--text-muted)]">
              จำนวนเดือนย้อนหลังที่ใช้เสนอเป้า
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1">
              {setting.targetLookbackMonths} เดือน
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ระยะเวลาย้อนหลังที่นำมาคำนวณฐานเป้าหมายใน Target Assist
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="targetOutlierThreshold" className="text-xs text-[var(--text-muted)]">
              สัดส่วนบิลสูงผิดปกติที่ต้องตัดออก
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1 tabular-nums">
              {formatDecimal(setting.targetOutlierThreshold)}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ยอดเกินเกณฑ์นี้จะถูกตัด/กรองออกใน Target Assist
            </p>
          </div>
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <dt title="targetGrowthRate" className="text-xs text-[var(--text-muted)]">
              อัตราเติบโตที่ใช้คำนวณเป้าหมาย
            </dt>
            <dd className="font-semibold text-base text-[var(--text-primary)] mt-1 tabular-nums">
              {formatDecimal(setting.targetGrowthRate)}
            </dd>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              ตัวคูณการเติบโตยอดขายในสูตรคำนวณของ Target Assist
            </p>
          </div>
        </dl>
      </Card>
    </div>
  );
}

export default EvaluationSettingReadOnly;
