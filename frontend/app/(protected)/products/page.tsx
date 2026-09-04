import { redirect } from "next/navigation";

/**
 * WACC-P2-002: `/products` merged into `/master-data?tab=products`.
 * This file is a bookmark/redirect stub — removed for good in WACC-P3-008.
 */
export default function ProductsPage() {
  redirect("/master-data?tab=products");
}

