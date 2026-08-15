// Types derived verbatim from the `User`/`Salesperson` fields of design.md's Prisma schema
// and from the shapes actually returned by backend/src/controllers/{auth,user}.controller.ts.

export type UserRole = "MANAGER" | "SALESPERSON";

export interface SalespersonSummary {
  id: string;
  displayName: string;
  nameInFile: string;
}

/** Full user record as returned by GET/POST/PATCH /users (userWithSalespersonSelect). */
export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  salesperson: SalespersonSummary | null;
}

/** Minimal user shape returned by POST /auth/login — what we keep in the auth store. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

// ---------- Module C: Excel Import & Master Data ----------
// Types derived verbatim from the `ImportBatch`/`ImportIssue`/`SalesLine`/`Hospital`/
// `Salesperson`/`ProductType` fields of design.md's Prisma schema, and from the shapes
// actually returned by backend/src/controllers/{import,masterData}.controller.ts.
// Prisma `Decimal` fields (qty/unitPrice/amount/vat/total) serialize to JSON as strings.

export type ImportStatus = "PROCESSING" | "SUCCESS" | "PARTIAL" | "FAILED";
export type ImportIssueLevel = "WARNING" | "ERROR";

export interface UploaderSummary {
  id: string;
  displayName: string;
  email: string;
}

export interface PeriodTouched {
  year: number;
  month: number;
}

export interface ImportIssue {
  id: string;
  importBatchId: string;
  sheetName: string | null;
  rowNumber: number | null;
  columnName: string | null;
  level: ImportIssueLevel;
  code: string;
  message: string;
  rawRow: Record<string, unknown> | null;
}

/** Full ImportBatch record — `issues` is only present on POST /import and GET /import-batches/:id. */
export interface ImportBatch {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedById: string;
  uploadedBy: UploaderSummary;
  startedAt: string;
  finishedAt: string | null;
  status: ImportStatus;
  sheetsFound: string[] | null;
  sheetsImported: string[] | null;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  periodsTouched: PeriodTouched[] | null;
  errorMessage: string | null;
  issues?: ImportIssue[];
}

export interface EntitySummary {
  id: string;
  displayName: string;
}

/** Row shape returned by GET /sales-lines (nested selects from import.controller.ts). */
export interface SalesLine {
  id: string;
  invoiceNo: string;
  poNo: string | null;
  invoiceDate: string;
  year: number;
  month: number;
  hospitalId: string;
  salespersonId: string;
  productId: string;
  productTypeId: string;
  lot: string | null;
  expiryDate: string | null;
  province: string | null;
  qty: string;
  unitPrice: string;
  amount: string;
  vat: string;
  total: string;
  rowKey: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  importBatchId: string;
  hospital: EntitySummary;
  salesperson: EntitySummary;
  product: { id: string; name: string };
  productType: { id: string; name: string };
}

export interface Hospital {
  id: string;
  nameInFile: string;
  displayName: string;
  province: string | null;
  isPreExistingCustomer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedUserSummary {
  id: string;
  email: string;
  displayName: string;
}

export interface Salesperson {
  id: string;
  nameInFile: string;
  displayName: string;
  isActive: boolean;
  userId: string | null;
  user: LinkedUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Module D: Targets ----------
// Types derived verbatim from the `Target`/`TargetProductGroup`/`TargetRevision` fields of
// design.md's Prisma schema, and from the shapes actually returned by
// backend/src/controllers/target.controller.ts. `revenueTarget` (Decimal) serializes to a
// string on GET/PUT target endpoints; inside TargetRevision.before/after the service converts
// Decimal -> Number before writing the JSON snapshot (see toTargetSnapshot), so those stay
// plain numbers.

export type TargetChangeType = "CREATE" | "UPDATE" | "DELETE";

export interface TargetProductGroupTarget {
  id: string;
  targetId: string;
  productTypeId: string;
  revenueTarget: string;
  /** Only present on GET /targets — listTargets includes it, the PUT endpoints don't. */
  productType?: { id: string; name: string };
}

export interface Target {
  id: string;
  salespersonId: string;
  year: number;
  month: number;
  revenueTarget: string;
  newCustomerTarget: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  productGroupTargets: TargetProductGroupTarget[];
  /** Only present on GET /targets — listTargets includes it, the PUT endpoints don't. */
  salesperson?: { id: string; displayName: string };
}

export interface TargetProductGroupSnapshot {
  productTypeId: string;
  revenueTarget: number;
}

export interface TargetSnapshot {
  id: string;
  salespersonId: string;
  year: number;
  month: number;
  revenueTarget: number;
  newCustomerTarget: number;
  note: string | null;
  productGroupTargets: TargetProductGroupSnapshot[];
}

export interface TargetRevisionChangedBy {
  id: string;
  displayName: string;
  email: string;
}

export interface TargetRevision {
  id: string;
  targetId: string;
  changeType: TargetChangeType;
  before: TargetSnapshot | null;
  after: TargetSnapshot | null;
  changedById: string;
  changedBy: TargetRevisionChangedBy;
  changedAt: string;
  note: string | null;
}

// ---------- Module E: KPI & Scoring Engine ----------
// Types derived verbatim from the `ScoringWeight`/`ScoringWeightRevision`/`EvaluationSetting`
// fields of design.md's Prisma schema and the "KPI & Scoring Rules" contract, and from the
// shapes actually returned by backend/src/controllers/{kpi,settings}.controller.ts and
// backend/src/services/kpi.service.ts. Drill-down rows are the same `SalesLine` shape as
// GET /sales-lines.

export type PeriodType = "MONTH" | "QUARTER" | "YEAR";

export interface PeriodKey {
  periodType: PeriodType;
  year: number;
  periodNumber: number;
}

export type ScoredKpiMetric =
  | "REVENUE_VS_TARGET"
  | "NEW_CUSTOMERS"
  | "PRODUCT_GROUP"
  | "RETENTION"
  | "CONSISTENCY";

export type SupplementaryKpiMetric =
  | "ACTIVE_CUSTOMERS"
  | "CHURNED_CUSTOMERS"
  | "PRODUCT_PENETRATION"
  | "REVENUE_BY_HOSPITAL"
  | "MONTHLY_TREND";

export type DrillDownMetric = ScoredKpiMetric | SupplementaryKpiMetric;

export interface MetricResult {
  metric: ScoredKpiMetric;
  computable: boolean;
  score: number | null;
  reason: string | null;
  detail: Record<string, unknown>;
}

export interface CompositeScoreResult {
  composite: number | null;
  computedFromCount: number;
  computedFromLabel: string;
  message: string | null;
  metrics: MetricResult[];
}

export interface ChurnedCustomerEntry {
  hospitalId: string;
  lastOrderYear: number;
  lastOrderMonth: number;
  monthsSinceLastOrder: number;
}

export interface ProductTypeGroupSold {
  productTypeId: string;
  name: string;
  revenueShare: number;
}

export interface RevenueByHospitalEntry {
  hospitalId: string;
  hospitalName: string;
  revenue: number;
  sharePercent: number;
}

export interface MonthlyTrendEntry {
  year: number;
  month: number;
  revenue: number;
}

export interface SupplementaryKpis {
  activeCustomers: { count: number; hospitalIds: string[] };
  churnedCustomers: { count: number; hospitals: ChurnedCustomerEntry[] };
  productPenetration: {
    avgDistinctProductTypesPerCustomer: number;
    productTypeGroupsSold: ProductTypeGroupSold[];
  };
  revenueShareByHospital: RevenueByHospitalEntry[];
  monthlyRevenueTrend: MonthlyTrendEntry[];
}

export interface SalespersonKpiResponse {
  salesperson: EntitySummary;
  period: PeriodKey;
  composite: CompositeScoreResult;
  supplementary: SupplementaryKpis;
}

export interface TeamKpiResultRow {
  salesperson: EntitySummary;
  composite: CompositeScoreResult;
}

export interface TeamKpiResponse {
  period: PeriodKey;
  results: TeamKpiResultRow[];
}

// kpi.service.ts's drill-down queries never include `salesperson` (already scoped by
// salespersonId) and only sometimes include `product`/`productType` depending on the metric —
// `hospital` is the only relation every metric includes. Reflect that instead of reusing the
// full `SalesLine` shape, which would falsely promise fields that aren't always there.
export interface KpiDrillDownSalesLine extends Omit<SalesLine, "salesperson" | "product" | "productType"> {
  product?: { id: string; name: string };
  productType?: { id: string; name: string };
}

export interface KpiDrillDownResponse {
  salesperson: EntitySummary;
  period: PeriodKey;
  metric: DrillDownMetric;
  salesLines: KpiDrillDownSalesLine[];
  retainedHospitalIds?: string[];
  trailingMonths?: { year: number; month: number }[];
  churnMonths?: number;
}

export interface ScoringWeight {
  id: string;
  metric: ScoredKpiMetric;
  weight: number;
  updatedAt: string;
}

export interface ScoringWeightSnapshotEntry {
  metric: ScoredKpiMetric;
  weight: number;
}

export interface ScoringWeightRevisionChangedBy {
  id: string;
  displayName: string;
  email: string;
}

export interface ScoringWeightRevision {
  id: string;
  before: ScoringWeightSnapshotEntry[];
  after: ScoringWeightSnapshotEntry[];
  changedById: string;
  changedBy: ScoringWeightRevisionChangedBy;
  changedAt: string;
  note: string | null;
}

export interface EvaluationSetting {
  id: string;
  churnMonths: number;
  minMonthsForChurn: number;
  minMonthsForConsistency: number;
  aiEnabled: boolean;
  aiAnonymize: boolean;
  updatedById: string | null;
  updatedAt: string;
}

// ---------- Module F: Dashboards & Leaderboard ----------
// Types derived verbatim from the shape actually returned by
// backend/src/controllers/leaderboard.controller.ts (Module F is read-only — no new Prisma
// models, per design.md's "Dependencies: E / Models: อ่านอย่างเดียว" entry for Module F).

export type LeaderboardCriteria = "COMPOSITE" | "PERCENT_TARGET" | "REVENUE" | "NEW_CUSTOMERS";

// ---------- Module G: AI Coaching Insights ----------
// Types derived verbatim from the `CoachingInsight` fields of design.md's Prisma schema and
// from the shapes actually returned by backend/src/controllers/coachingInsight.controller.ts.
// `kpiSnapshot` is never rendered by the frontend (it's an audit trail of what was sent to
// Gemini), so it's typed as opaque JSON rather than the service's internal KpiSummaryPayload
// shape.

export type InsightStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface CoachingInsight {
  id: string;
  salespersonId: string;
  periodType: PeriodType;
  year: number;
  periodNumber: number;
  kpiSnapshot: unknown;
  contentTh: string | null;
  status: InsightStatus;
  provider: string | null;
  model: string | null;
  errorMessage: string | null;
  isStale: boolean;
  generatedById: string | null;
  generatedAt: string;
}

/** GET /coaching-insights/:salespersonId — `insight` is null when none has been generated yet. */
export interface CoachingInsightGetResponse {
  salesperson: EntitySummary;
  period: PeriodKey;
  insight: CoachingInsight | null;
}

/** POST /coaching-insights/:salespersonId/generate */
export interface CoachingInsightGenerateResponse {
  insight: CoachingInsight;
}

export interface LeaderboardEntry {
  salesperson: EntitySummary;
  value: number | null;
  computable: boolean;
  reason: string | null;
  rank: number | null;
}

export interface LeaderboardResponse {
  criteria: LeaderboardCriteria;
  period: PeriodKey;
  results: LeaderboardEntry[];
}

// ---------- Module H: Coaching Reports & Export ----------
// Types derived verbatim from the shapes actually returned by
// backend/src/controllers/report.controller.ts and backend/src/services/report.service.ts.
// Module H is read-only — it composes Module E's CompositeScoreResult/SupplementaryKpis and
// Module G's CoachingInsight, no new Prisma models, per design.md's "Models: อ่านอย่างเดียว"
// entry for Module H. The `/export` endpoints stream back an `.xlsx` file, not JSON.

export interface IndividualReportData {
  salesperson: EntitySummary;
  period: PeriodKey;
  previousPeriod: PeriodKey;
  composite: CompositeScoreResult;
  previousComposite: CompositeScoreResult;
  supplementary: SupplementaryKpis;
  coachingInsight: CoachingInsight | null;
}

export interface TeamOverviewEntry {
  salesperson: EntitySummary;
  composite: CompositeScoreResult;
}

export interface TeamOverviewData {
  period: PeriodKey;
  results: TeamOverviewEntry[];
}
