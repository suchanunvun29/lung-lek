"use client";

import { Salesperson } from "@/lib/types";

interface SalespersonSwitcherProps {
  salespeople: Salesperson[];
  value: string;
  onChange: (salespersonId: string) => void;
}

export default function SalespersonSwitcher({ salespeople, value, onChange }: SalespersonSwitcherProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="font-medium text-zinc-600">มุมมอง</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2"
      >
        {salespeople.map((sp) => (
          <option key={sp.id} value={sp.id}>
            {sp.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
