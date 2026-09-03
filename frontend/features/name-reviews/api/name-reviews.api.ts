import { request } from "@/lib/api-client";
import {
  HospitalNameReview,
  SalesmanNameReview,
  SalesmanNameRule,
} from "@/lib/types";

export function listHospitalNameReviews(token: string) {
  return request<{ hospitalNameReviews: HospitalNameReview[] }>(
    "/hospital-name-reviews",
    { method: "GET" },
    token
  );
}

export type HospitalNameReviewDecision =
  | { decision: "MERGED"; mergedIntoId?: number; note?: string }
  | { decision: "KEPT_SEPARATE"; note?: string };

export function decideHospitalNameReview(
  token: string,
  id: number,
  input: HospitalNameReviewDecision
) {
  return request<{ hospitalNameReview: HospitalNameReview }>(
    `/hospital-name-reviews/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function listSalesmanNameRules(token: string) {
  return request<{ salesmanNameRules: SalesmanNameRule[] }>(
    "/salesman-name-rules",
    { method: "GET" },
    token
  );
}

export function listSalesmanNameReviews(token: string) {
  return request<{ salesmanNameReviews: SalesmanNameReview[] }>(
    "/salesman-name-reviews",
    { method: "GET" },
    token
  );
}

export type SalesmanNameReviewDecision =
  | { decision: "MERGED"; mergedIntoId: number; note?: string }
  | { decision: "KEPT_SEPARATE"; note?: string };

export function decideSalesmanNameReview(
  token: string,
  id: number,
  input: SalesmanNameReviewDecision
) {
  return request<{ salesmanNameReview: SalesmanNameReview }>(
    `/salesman-name-reviews/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function updateSalesmanNameRule(
  token: string,
  id: number,
  members: { salespersonId: number; sharePercent: number }[]
) {
  return request<{ salesmanNameRule: SalesmanNameRule }>(
    `/salesman-name-rules/${id}`,
    { method: "PATCH", body: JSON.stringify({ members }) },
    token
  );
}
