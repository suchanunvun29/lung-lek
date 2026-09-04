import { redirect } from "next/navigation";

/**
 * WACC-P1-005: `/reports/individual` merged into `/performance/individual`.
 * This file is a bookmark/redirect stub — removed for good in WACC-P3-008.
 * No local file replaces the old page: the merged page is the only implementation.
 */
export default function IndividualReportPage() {
  redirect("/performance/individual");
}
