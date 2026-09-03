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
  isSalespersonLinked: boolean;
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
export type ImportMode = "APPEND" | "REPLACE_PERIOD" | "PERIOD_DELETE";

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

// ---------- Module J: name-resolution review queues ----------

export type NameDecisionSource = "AUTO" | "MANAGER";
export type HospitalNameReviewStatus = "PENDING" | "MERGED" | "KEPT_SEPARATE";

export interface HospitalNameReview {
  id: string;
  normalizedKeyA: string;
  normalizedKeyB: string;
  sampleRawA: string;
  sampleRawB: string;
  similarity: string | null;
  status: HospitalNameReviewStatus;
  mergedIntoId: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface SalesmanNameRuleMember {
  id: string;
  ruleId: string;
  salespersonId: string;
  sharePercent: string;
  salesperson: SalespersonSummary;
}

export interface SalesmanNameRule {
  id: string;
  normalizedRaw: string;
  sampleRaw: string;
  decidedById: string | null;
  decidedAt: string | null;
  createdAt: string;
  members: SalesmanNameRuleMember[];
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
  mode: ImportMode;
  targetPeriods: PeriodTouched[] | null;
  removedRows: number;
  confirmedById: string | null;
  periodsTouched: PeriodTouched[] | null;
  errorMessage: string | null;
  issues?: ImportIssue[];
}

export interface PeriodRemovalSample {
  invoiceNo: string;
  hospitalName: string;
  total: string;
}

export interface PeriodDryRunPreview {
  targetPeriods: PeriodTouched[];
  existingRows: number;
  existingTotal: string;
  insertedRows: number;
  updatedRows: number;
  removedRows: number;
  removalSamples: PeriodRemovalSample[];
  willDeletePeriodWithoutReplacement: boolean;
}

export interface PeriodDryRunResponse {
  dryRun: true;
  preview: PeriodDryRunPreview;
}

export interface PeriodImportConfirmedResponse {
  dryRun: false;
  importBatch: ImportBatch;
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

// ---------- Module K: Hospital registry, province mapping and registry links ----------

export type RegistryLinkStatus = "UNREVIEWED" | "LINKED" | "CONFIRMED_ABSENT";
export type RegistryLinkMethod = "EXACT" | "NORMALIZED" | "FUZZY" | "MANUAL";
export type HospitalCategory = "GOVERNMENT_GENERAL" | "UNIVERSITY" | "PRIVATE" | "OTHER";
export type PotentialMetricKey = "BEDS" | "CMI" | "SUM_ADJ_RW" | "OCCUPANCY_RATE" | "PATIENTS" | "VISITS";
export type TerritoryLinkSource = "INFERRED" | "MANUAL";

export interface Region {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ProvinceMapping {
  id: string;
  canonicalName: string;
  regionId: string;
  region: Region;
}

export interface HospitalRegistryMetric {
  id: string;
  metric: PotentialMetricKey;
  value: string;
  periodYear: number | null;
  periodMonth: number | null;
}

export interface HospitalRegistry {
  id: string;
  sourceCode: string | null;
  nameInFile: string;
  displayName: string;
  provinceMappingId: string | null;
  provinceMapping: ProvinceMapping | null;
  provinceRaw: string;
  regionId: string | null;
  region: Region | null;
  healthZone: string | null;
  tier: string | null;
  category: HospitalCategory;
  potentialAdjustment: string;
  isActive: boolean;
  sourceFile: string | null;
  territoryId: string | null;
  territory: EntitySummary | null;
  territorySource: TerritoryLinkSource;
  metrics: HospitalRegistryMetric[];
}

export interface HospitalRegistryLink {
  id: string;
  hospitalId: string;
  hospitalRegistryId: string | null;
  status: RegistryLinkStatus;
  method: RegistryLinkMethod | null;
  confidence: string | null;
  note: string | null;
  updatedAt: string;
  hospital: Hospital & { provinceMapping?: ProvinceMapping | null };
  hospitalRegistry: HospitalRegistry | null;
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
  employmentEndedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Module J (2026-08-22): salesman auto-create review queue ----------

export interface SalesmanNameReview {
  id: string;
  personKey: string;
  sampleRaw: string;
  status: HospitalNameReviewStatus; // same enum: PENDING | MERGED | KEPT_SEPARATE ("คนใหม่จริง")
  createdSalespersonId: string | null;
  createdSalesperson: SalespersonSummary | null;
  mergedIntoId: string | null;
  mergedInto: SalespersonSummary | null;
  decidedById: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

// ---------- Module M: Territories ----------

export type TargetScope = "SALESPERSON" | "TERRITORY" | "TERRITORY_GROUP";

export interface RegionSummary {
  id: string;
  name: string;
}

export interface Territory {
  id: string;
  name: string;
  code: string | null;
  regionId: string | null;
  region: RegionSummary | null;
  sortOrder: number;
  isActive: boolean;
  note: string | null;
  activeOwnerCount: number;
  hospitalCount: number;
}

export interface TerritoryAssignment {
  id: string;
  territoryId: string;
  salespersonId: string;
  isSupervisor: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  /** Raw Territory include — its display field is `name`, not `displayName`. */
  territory: { id: string; name: string };
  salesperson: SalespersonSummary;
}

export interface UnassignedTerritoryHospital {
  id: string;
  displayName: string;
  province: string | null;
  /** Credit-weighted & exclusion-aware amount for this hospital; `ambiguous` = 2nd-ranked contributor ≥30% of 1st. */
  unassignedBucket: number;
  ambiguous: boolean;
}

export interface TerritoryGroup {
  id: string;
  name: string;
  isActive: boolean;
  note: string | null;
  members: TerritoryGroupMember[];
}

export interface TerritoryGroupMember {
  id: string;
  territoryId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Raw Territory include — its display field is `name`, not `displayName`. */
  territory: { id: string; name: string };
}

export type DerivedTargetSource = "MANUAL" | "TERRITORY" | "TERRITORY_GROUP";

/** One contribution line of GET /targets/derived — a TERRITORY or TERRITORY_GROUP target split by active owners.
 *  `unassigned: true` marks a unit with no active owner: it must surface as its own block, never silently dropped. */
export interface DerivedTargetContribution {
  territoryId?: string;
  territoryGroupId?: string;
  revenueTarget: number;
  unassigned?: boolean;
}

/** Response of GET /targets/derived/:salespersonId/:year/:month (see territory.service.getDerivedTarget). */
export interface DerivedTarget {
  revenueTarget: number;
  newCustomerTarget: number;
  source: DerivedTargetSource;
  items: DerivedTargetContribution[];
}

// ---------- Module N: Territory KPI ----------

export type TerritoryKpiVisibility = "TERRITORY_FULL" | "TERRITORY_RANK_ONLY";

export interface TerritoryKpiFullRow {
  territoryId: string;
  name: string;
  ownerNames: string[];
  revenue: number;
  target: number | null;
  /** "ไม่ได้ตั้งเป้าแยก (อยู่ในเป้ารวมของกลุ่ม X)" for a TerritoryGroup member, else null. */
  targetLabel: string | null;
  achievementPercent: number | null;
  compositeScore: number | null;
  computedMetricLabel: string;
  /** Set when compositeScore is null — shown in place of the score (no computable criterion). */
  message: string | null;
  metrics: MetricResult[];
  visibility: "TERRITORY_FULL";
  rank: number;
}

export interface TerritoryKpiRankOnlyRow {
  territoryId: string;
  name: string;
  ownerNames: string[];
  compositeScore: number | null;
  computedMetricLabel: string;
  visibility: "TERRITORY_RANK_ONLY";
  rank: number;
}

export type TerritoryKpiRow = TerritoryKpiFullRow | TerritoryKpiRankOnlyRow;

export interface TerritoryPersonalBucketEntry {
  salespersonId: string;
  displayName: string;
  revenue: number;
  personalTarget: number;
  achievementPercent: number | null;
}

export interface TerritoryKpiBuckets {
  companyTotal: number;
  territorySum: number;
  personalBucket: number;
  unassignedBucket: number;
  personalBucketEntries: TerritoryPersonalBucketEntry[];
  unassignedHospitalCount: number;
}

export interface TerritoryKpiTeamResponse {
  period: PeriodKey;
  territories: TerritoryKpiRow[];
  buckets?: TerritoryKpiBuckets;
}

export interface TerritoryKpiDrillDownResponse {
  territory: EntitySummary;
  metric: DrillDownMetric;
  productTypes: { id: string; name: string; revenue: number }[];
  hospitals: { id: string; name: string; revenue: number }[];
}

export interface TerritoryGroupKpiFullRow {
  territoryId: string;
  name: string;
  ownerNames: string[];
  memberTerritoryIds: string[];
  revenue: number;
  revenueTarget: number | null;
  achievementPercent: number | null;
  compositeScore: number | null;
  computedMetricLabel: string;
  rank: number;
  visibility: "TERRITORY_FULL";
}

export interface TerritoryGroupKpiRankOnlyRow {
  territoryId: string;
  name: string;
  ownerNames: string[];
  compositeScore: number | null;
  computedMetricLabel: string;
  rank: number;
  visibility: "TERRITORY_RANK_ONLY";
}

export type TerritoryGroupKpiRow = TerritoryGroupKpiFullRow | TerritoryGroupKpiRankOnlyRow;

export interface TerritoryOverviewResponse extends TerritoryKpiTeamResponse {
  territoryGroups: TerritoryGroupKpiRow[];
}

// ---------- Module P1: Salesperson territory view ----------

export type MyTerritoryViewMode = "TERRITORY_TOTAL" | "OWN_CREDIT_ONLY" | "NATIONWIDE_PRODUCT_TYPE_FALLBACK";

export interface MyTerritoryViewResponse {
  period: PeriodKey;
  salesperson: EntitySummary;
  territories: EntitySummary[];
  mode: MyTerritoryViewMode;
  creditOnly: boolean;
  productTypeId: string | null;
  soldHospitals: { hospital: { id: string; displayName: string }; revenue: number }[];
  soldBeforeButNotInPeriod: { hospital: { id: string; displayName: string; province: string | null } }[];
}

// ---------- Module P2: Never-sold government hospitals ----------

export interface NeverSoldHospitalItem {
  id: string;
  displayName: string;
  province: string;
  provinceMappingId: string | null;
  tier: string | null;
  category: string;
  metricKey: string;
  metricValue: number;
  territory: EntitySummary | null;
}

export interface NeverSoldHospitalsResponse {
  period: PeriodKey;
  salesperson: EntitySummary;
  territories: EntitySummary[];
  mode: MyTerritoryViewMode;
  potentialMetric: string;
  topN: number;
  provinceMappingId: string | null;
  productTypeId: string | null;
  totalNeverSold: number;
  neverSoldHospitals: NeverSoldHospitalItem[];
}

export type ProductZeroSaleStatus = "SOLD_BEFORE_NOT_IN_PERIOD" | "NEVER_SOLD_IN_TERRITORY";

export interface TerritoryProductRankingItem { productId: string; code: string; name: string; productType: { id: string; name: string }; revenue: number; quantity: number; zeroSaleStatus: ProductZeroSaleStatus | null; }
/** GET /territory-products/ranking sends the raw Territory model (`name`), not an EntitySummary (`displayName`). */
export interface TerritoryProductRankingTerritory { id: string; name: string; ownerNames: string[]; }
export interface TerritoryProductRankingResponse { period: PeriodKey; territory: TerritoryProductRankingTerritory; items: TerritoryProductRankingItem[]; zeroSaleWarning: string; personalBucket?: Omit<TerritoryProductRankingItem, "zeroSaleStatus">[]; }

// ---------- Module O: Product Master ----------

export type ProductSource = "SALES_HISTORY" | "CATALOG";

export interface ProductMasterItem {
  id: string;
  name: string;
  code: string | null;
  displayName: string | null;
  source: ProductSource;
  isActive: boolean;
  productType: { id: string; name: string };
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
  scope: TargetScope;
  territoryId: string | null;
  territoryGroupId: string | null;
  salespersonId: string | null;
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
  territory?: { id: string; name: string };
  territoryGroup?: { id: string; name: string };
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
  reason?: "ACCOUNT_NOT_LINKED";
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
  /** Module L — Decimals serialize to JSON as strings (same convention as the header note above). */
  potentialMetric: PotentialMetricKey;
  minRegionCoverage: string;
  targetSuggestionAlpha: string;
  targetLookbackMonths: number;
  targetOutlierThreshold: string;
  targetGrowthRate: string;
  updatedById: string | null;
  updatedAt: string;
}

// ---------- Module F: Dashboards ----------
// The old person-ranked leaderboard (Phase 5) was replaced wholesale by Module F2's
// territory-unit leaderboard — its types live in the Module F2 block below.

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
  canGenerate: boolean;
}

/** POST /coaching-insights/:salespersonId/generate */
export interface CoachingInsightGenerateResponse {
  insight: CoachingInsight;
}

// ---------- Module F2: Leaderboard 2 tiers ----------
// Types derived verbatim from the shapes actually returned by
// backend/src/controllers/territoryLeaderboard.controller.ts. Every unit's fields depend on the
// server-sent `visibility` level (Data Visibility Rules ข้อ 6) — restricted units carry exactly
// the whitelist, so the page renders only what actually arrives.

export type LeaderboardCriteria = "COMPOSITE" | "PERCENT_TARGET" | "REVENUE" | "NEW_CUSTOMERS";

interface LeaderboardUnitBase {
  unitType: "TERRITORY" | "GROUP";
  territoryId: string;
  name: string;
  ownerNames: string[];
  rank: number | null;
  compositeScore: number | null;
  computedMetricLabel: string;
}

export interface LeaderboardFullUnit extends LeaderboardUnitBase {
  visibility: "TERRITORY_FULL";
  criterionReason: string | null;
  members?: LeaderboardMemberRow[];
  revenue?: number;
  target?: number | null;
  targetLabel?: string | null;
  achievementPercent?: number | null;
  metrics?: TerritoryKpiFullRow["metrics"];
  message?: string | null;
}

export interface LeaderboardRankOnlyUnit extends LeaderboardUnitBase {
  visibility: "TERRITORY_RANK_ONLY";
  members?: LeaderboardMemberRow[];
}

export type TerritoryKpiFullRowMetrics = TerritoryKpiFullRow["metrics"];

export type LeaderboardUnit = LeaderboardFullUnit | LeaderboardRankOnlyUnit;

export type LeaderboardBuckets = TerritoryKpiBuckets;

export interface TerritoryLeaderboardResponse {
  criteria: LeaderboardCriteria;
  period: PeriodKey;
  ranked: LeaderboardUnit[];
  unranked: LeaderboardUnit[];
  buckets?: LeaderboardBuckets;
}

export interface LeaderboardMemberRow {
  visibility: "TERRITORY_FULL" | "TERRITORY_RANK_ONLY";
  territoryId: string;
  name: string;
  ownerNames: string[];
  rank?: number;
  compositeScore: number | null;
  computedMetricLabel: string;
  revenue?: number;
  target?: number | null;
  targetLabel?: string | null;
  achievementPercent?: number | null;
}

/** GET /leaderboard/territories/:territoryId/people — tier-2 drill-down (MANAGER/supervisor). */
export interface LeaderboardPeopleResponse {
  mode: "FULL";
  results: { salesperson: EntitySummary; composite: CompositeScoreResult }[];
}

/** SELF_SUMMARY variant for plain salespeople (Data Visibility Rules ข้อ 7). */
export interface LeaderboardSelfSummaryResponse {
  mode: "SELF_SUMMARY";
  criteria: LeaderboardCriteria;
  rank: number | null;
  totalRanked: number;
  ownValue: number | null;
  ownComputable: boolean;
  reason: string | null;
  teamAverage: number | null;
}

export type LeaderboardPeopleOrSummary = LeaderboardPeopleResponse | LeaderboardSelfSummaryResponse;

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

// ---------- Module L: Area potential & target assist ----------
// Types derived verbatim from the shapes actually returned by
// backend/src/services/targetSuggestion.service.ts (buildTargetSuggestionPreview) and
// backend/src/services/tierWeight.service.ts (getEffectiveTierWeights). All numbers in the
// preview payload pass through Number() on the backend, so they are real JSON numbers here.

export type SuggestionMode = "SUGGEST" | "REBALANCE";

/** GET/PATCH /settings/tier-weights — `weight` is a Prisma Decimal → string, `updatedAt` is null for tiers still at the default 1.000. */
export interface TierWeightRow {
  tier: string;
  weight: string;
  isCustom: boolean;
  updatedAt: string | null;
}

export interface TargetSuggestionSettings {
  potentialMetric: PotentialMetricKey;
  minRegionCoverage: number;
  targetSuggestionAlpha: number;
  targetLookbackMonths: number;
  targetOutlierThreshold: number;
  /** The value this preview used — the setting's value or a per-round override. */
  targetGrowthRate: number;
}

export interface SuggestionWindow {
  start: { year: number; month: number } | null;
  end: { year: number; month: number } | null;
  /** Months inside the window that actually hold data — the divisor (design Risks ข้อ 18). */
  monthsUsed: number;
}

/** One territory row inside a region block of GET /target-suggestions. */
export interface TerritorySuggestionRow {
  territoryId: string;
  territoryName: string;
  potential: number;
  potentialShare: number;
  /** null = the unit has no sales at all → coverage cap 0. */
  territoryCoverage: number | null;
  historyBeforeCut: number;
  historyAfterCut: number;
  historyBased: number;
  potentialBased: number;
  w: number;
  suggested: number;
  /** Display-only baht per potential unit — never a percent (Territory & Potential Rules ข้อ 4). */
  penetrationIndex: number | null;
}

export interface RegionSuggestionGroup {
  regionId: string;
  regionName: string;
  coveragePass: boolean;
  /** null = the region has no sales at all. */
  regionCoverage: number | null;
  r: number;
  suggestedSum: number;
  differenceFromR: number;
  territories: TerritorySuggestionRow[];
}

export interface UnmappedBaseEntry {
  territoryId: string;
  territoryName: string;
  unmappedBase: number;
  unmappedHospitalCount: number;
}

/** Σ suggested over every region + unmappedBase — the number "รับข้อเสนอ" writes into Target. */
export interface TerritorySuggestedTotal {
  territoryId: string;
  territoryName: string;
  suggestedTotal: number;
}

export interface CutDealEntry {
  territoryId: string;
  territoryName: string;
  invoiceNo: string;
  dealValue: number;
  ratio: number;
}

/** Payload of GET /target-suggestions/:year/:month and POST /target-suggestions/reinstate-deal. */
export interface TargetSuggestionPreview {
  year: number;
  month: number;
  mode: SuggestionMode;
  settings: TargetSuggestionSettings;
  window: SuggestionWindow;
  regions: RegionSuggestionGroup[];
  unmapped: UnmappedBaseEntry[];
  totals: TerritorySuggestedTotal[];
  cutDeals: CutDealEntry[];
}

export interface ReinstateDealResponse extends TargetSuggestionPreview {
  reinstatedInvoiceNos: string[];
}
