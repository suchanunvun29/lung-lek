"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

const ROLE_LABEL_TH: Record<string, string> = {
  MANAGER: "ผู้จัดการ",
  SALESPERSON: "พนักงานขาย",
};

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    ...(user!.role === "MANAGER" ? [{ href: "/import", label: "นำเข้าข้อมูล" }] : []),
    { href: "/import-batches", label: "ประวัติการนำเข้า" },
    { href: "/sales-lines", label: "ข้อมูลการขาย" },
    { href: "/master-data", label: "Master Data" },
    ...(user!.role === "MANAGER"
      ? [
          { href: "/name-reviews", label: "ยืนยันชื่อซ้ำ" },
          { href: "/products", label: "ทะเบียนสินค้า" },
          { href: "/hospital-registry", label: "ทะเบียนโรงพยาบาล" },
        ]
      : []),
    { href: "/targets", label: "ตั้งเป้า" },
    ...(user!.role === "MANAGER" ? [{ href: "/target-assist", label: "ตัวช่วยตั้งเป้า" }] : []),
    { href: "/territories", label: "จัดการเขต" },
    { href: "/kpi", label: "ผลการประเมิน" },
    { href: "/territory-kpi", label: "KPI รายเขต" },
    { href: "/my-territory", label: "พื้นที่รับผิดชอบ" },
    { href: "/territory-products", label: "อันดับสินค้า" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/reports/individual", label: "รายงานรายบุคคล" },
    { href: "/reports/team-overview", label: "ภาพรวมทีม" },
    { href: "/settings/scoring-weights", label: "น้ำหนักคะแนน" },
    { href: "/settings/evaluation", label: "ค่าคงที่การประเมิน" },
    ...(user!.role === "MANAGER" ? [{ href: "/settings/tier-weights", label: "น้ำหนักระดับ รพ." }] : []),
    ...(user!.role === "MANAGER" ? [{ href: "/users", label: "จัดการผู้ใช้งาน" }] : []),
    { href: "/account", label: "บัญชีของฉัน" },
  ];

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-lg font-semibold text-zinc-900">ระบบประเมินพนักงานขาย</span>
        <div className="flex flex-wrap gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                pathname === link.href
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-zinc-600">
        <span>
          {user.displayName} · {ROLE_LABEL_TH[user.role]}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100"
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}
