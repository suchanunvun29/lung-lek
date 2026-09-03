// Re-export shared client foundation
export {
  API_BASE_URL,
  ApiError,
  request,
  downloadFile,
  periodQueryParams,
  KNOWN_ERROR_TRANSLATIONS,
  getErrorMessage,
} from "./api-client";

// Re-export all domain APIs for backwards compatibility
export * from "@/features/auth/api/auth.api";
export * from "@/features/coaching/api/coaching.api";
export * from "@/features/hospital-registry/api/hospital-registry.api";
export * from "@/features/import/api/import.api";
export * from "@/features/kpi/api/kpi.api";
export * from "@/features/leaderboard/api/leaderboard.api";
export * from "@/features/master-data/api/master-data.api";
export * from "@/features/name-reviews/api/name-reviews.api";
export * from "@/features/products/api/products.api";
export * from "@/features/reports/api/reports.api";
export * from "@/features/sales-lines/api/sales-lines.api";
export * from "@/features/settings/api/settings.api";
export * from "@/features/targets/api/targets.api";
export * from "@/features/target-assist/api/target-assist.api";
export * from "@/features/territories/api/territories.api";
export * from "@/features/territory-kpi/api/territory-kpi.api";
export * from "@/features/users/api/users.api";
