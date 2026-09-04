/**
 * navigation.config.ts — WACC-P0-014
 *
 * Single data structure for the six sidebar groups defined in §13.1.
 * Role rules are transcribed verbatim from NavBar.tsx:28-52 — do NOT add or
 * remove any entry's role rule without an explicit product decision.
 *
 * Context flags:
 *  - showPeriodSelector: true when the route uses a global period selector
 *  - showSalespersonSelector: true when the route uses a salesperson subject selector
 *
 * These are consulted by ContextBar (WACC-P0-015) to decide what to render in the
 * header. Adding a new route means adding a new entry — never editing ContextBar.
 */

import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  /** Thai label — copied verbatim from NavBar.tsx (two exceptions: "Master Data"→"ข้อมูลหลัก",
   *  "ผลการประเมิน"→"ผลงานรายบุคคล" as specified in the task). */
  label: string;
  icon: LucideIcon;
  /** When true, this item is hidden from SALESPERSON users. */
  managerOnly?: boolean;
  /** Key into a future badge count map (WACC-P1-015). Declared now so the slot exists. */
  badgeKey?: string;
  /** Whether the global PeriodSelector should be shown for this route. */
  showPeriodSelector?: boolean;
  /** Whether the global SalespersonSwitcher should be shown for this route. */
  showSalespersonSelector?: boolean;
}

export interface NavGroup {
  /** Group heading shown in the expanded sidebar. */
  label: string;
  /** Base path for prefix-based group highlighting. */
  basePath: string;
  items: NavItem[];
  /** When true, the entire group is hidden from SALESPERSON users. */
  managerOnly?: boolean;
}

// We import icons lazily via string names at runtime to keep this file importable
// by server components. The icon components are injected by the Sidebar component.
// For type safety we import LucideIcon statically here.
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  Map,
  BarChart2,
  Upload,
  ClipboardList,
  ShoppingBag,
  Database,
  UserCheck,
  Hospital,
  Trophy,
  Users,
  MapPin,
  Crosshair,
  GitBranch,
  Layers,
  Sliders,
  Scale,
} from "lucide-react";

export const NAV_GROUPS: NavGroup[] = [
  // ── 1. ภาพรวม (Overview) ─────────────────────────────────
  {
    label: "ภาพรวม",
    basePath: "/dashboard",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        showPeriodSelector: true,
        showSalespersonSelector: true,
      },
    ],
  },

  // ── 2. ผลงาน (Performance) ───────────────────────────────
  {
    label: "ผลงาน",
    basePath: "/performance",
    items: [
      {
        href: "/performance/individual",
        label: "ผลงานรายบุคคล",      // merged from /kpi + /reports/individual per WACC-P1-005
        icon: TrendingUp,
        showPeriodSelector: true,
        showSalespersonSelector: true,
      },
      {
        href: "/leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        showPeriodSelector: true,
      },
      {
        href: "/reports/team-overview",
        label: "ภาพรวมทีม",
        icon: BarChart2,
        showPeriodSelector: true,
      },
    ],
  },

  // ── 3. เป้าหมาย (Targets) ────────────────────────────────
  {
    label: "เป้าหมาย",
    basePath: "/target",
    items: [
      {
        href: "/targets",
        label: "ตั้งเป้า",
        icon: Target,
        showPeriodSelector: true,
      },
      {
        href: "/target-assist",
        label: "ตัวช่วยตั้งเป้า",
        icon: Crosshair,
        managerOnly: true,
        showPeriodSelector: true,
      },
      {
        href: "/territory-kpi",
        label: "KPI รายเขต",
        icon: Map,
        showPeriodSelector: true,
      },
      {
        href: "/territories/targets",
        label: "เป้ารายเขต",
        icon: Layers,
        managerOnly: true,
        showPeriodSelector: true,
      },
    ],
  },

  // ── 4. พื้นที่และลูกค้า (Territory & Customers) ─────────
  {
    label: "พื้นที่และลูกค้า",
    basePath: "/territories",
    items: [
      {
        href: "/territories",
        label: "จัดการเขต",
        icon: MapPin,
      },
      {
        href: "/territories/moves",
        label: "ย้ายโรงพยาบาล",
        icon: GitBranch,
        managerOnly: true,
      },
      {
        href: "/territories/unassigned",
        label: "โรงพยาบาลไม่มีเขต",
        icon: Hospital,
        managerOnly: true,
        badgeKey: "unassignedHospitals",
      },
      {
        href: "/my-territory",
        label: "พื้นที่รับผิดชอบ",
        icon: Map,
        showPeriodSelector: true,
      },
      {
        href: "/hospital-registry",
        label: "ทะเบียนโรงพยาบาล",
        icon: Hospital,
        managerOnly: true,
      },
    ],
  },

  // ── 5. ข้อมูลการขาย (Sales Data) ─────────────────────────
  {
    label: "ข้อมูลการขาย",
    basePath: "/sales",
    items: [
      {
        href: "/sales-lines",
        label: "ข้อมูลการขาย",
        icon: ShoppingBag,
        showPeriodSelector: true,
      },
      {
        href: "/territory-products",
        label: "อันดับสินค้า",
        icon: BarChart2,
        showPeriodSelector: true,
      },
      {
        href: "/master-data",
        label: "ข้อมูลหลัก",          // renamed from "Master Data" per design
        icon: Database,
      },
      {
        href: "/products",
        label: "ทะเบียนสินค้า",
        icon: Layers,
        managerOnly: true,
      },
      {
        href: "/import",
        label: "นำเข้าข้อมูล",
        icon: Upload,
        managerOnly: true,
      },
      {
        href: "/import-batches",
        label: "ประวัติการนำเข้า",
        icon: ClipboardList,
      },
      {
        href: "/name-reviews",
        label: "ยืนยันชื่อซ้ำ",
        icon: UserCheck,
        managerOnly: true,
        badgeKey: "pendingNameReviews",
      },
    ],
  },

  // ── 6. ตั้งค่า (Settings) — divider above ────────────────
  {
    label: "ตั้งค่า",
    basePath: "/settings",
    items: [
      {
        href: "/settings/scoring-weights",
        label: "น้ำหนักคะแนน",
        icon: Scale,
      },
      {
        href: "/settings/evaluation",
        label: "ค่าคงที่การประเมิน",
        icon: Sliders,
      },
      {
        href: "/settings/tier-weights",
        label: "น้ำหนักระดับ รพ.",
        icon: Layers,
        managerOnly: true,
      },
      {
        href: "/users",
        label: "จัดการผู้ใช้งาน",
        icon: Users,
        managerOnly: true,
      },
    ],
  },
];

/**
 * Flat lookup of all nav items for breadcrumb resolution.
 * Includes both group-level and item-level hrefs.
 */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * Returns true when the given pathname falls within the given group's scope.
 * Uses startsWith on the group's basePath OR exact match on any item's href.
 */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.items.some((item) => pathname === item.href)) return true;
  // For groups whose basePath is a real prefix (e.g. /target covers /target-assist)
  return group.items.some(
    (item) => pathname.startsWith(item.href + "/") || item.href !== "/" && pathname.startsWith(item.href)
  );
}

/**
 * Returns true when the item's href is the active route.
 * Uses exact match for the href, or startsWith for deeper paths under the same route.
 */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  // Allow sub-routes to highlight the parent (e.g. /targets/12/revisions → /targets)
  if (item.href !== "/" && pathname.startsWith(item.href + "/")) return true;
  return false;
}

/**
 * Returns the nav item matching the given pathname, or undefined.
 */
export function findNavItemByPath(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => isItemActive(item, pathname));
}

/**
 * Returns the nav group containing the given pathname, or undefined.
 */
export function findNavGroupByPath(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((group) => isGroupActive(group, pathname));
}
