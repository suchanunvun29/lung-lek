"use client";

import { Salesperson } from "@/lib/types";
import { Select } from "@/components/ui/select";

export interface SalespersonSwitcherProps {
  salespeople: Salesperson[];
  value: string;
  onChange: (salespersonId: string) => void;
}

export function SalespersonSwitcher({ salespeople, value, onChange }: SalespersonSwitcherProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="font-medium text-zinc-600">มุมมอง</label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-auto min-w-40"
      >
        {salespeople.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {sp.displayName}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default SalespersonSwitcher;
