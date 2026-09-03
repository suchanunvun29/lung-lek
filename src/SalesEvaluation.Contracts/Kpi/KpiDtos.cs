namespace SalesEvaluation.Contracts.Kpi;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Enums;

// ---------- Module E: KPI & Scoring Engine ----------
// Shapes mirror frontend/lib/types.ts Module E. Computed values are JS numbers in Express —
// double here. DB Decimal passthrough (drill-down SalesLine money columns) stays string.

public class MetricResultDto
{
    public KpiMetric Metric { get; set; }
    public bool Computable { get; set; }
    public double? Score { get; set; }
    public string? Reason { get; set; }
    public Dictionary<string, object?> Detail { get; set; } = new();
}

public class CompositeScoreResultDto
{
    public double? Composite { get; set; }
    public int ComputedFromCount { get; set; }
    public string ComputedFromLabel { get; set; } = string.Empty;
    public string? Message { get; set; }
    public List<MetricResultDto> Metrics { get; set; } = new();
}

// ---------- Supplementary KPIs (shown but not scored) ----------

public class ChurnedCustomerEntryDto
{
    public int HospitalId { get; set; }
    public int LastOrderYear { get; set; }
    public int LastOrderMonth { get; set; }
    public int MonthsSinceLastOrder { get; set; }
}

public class ProductTypeGroupSoldDto
{
    public int ProductTypeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double RevenueShare { get; set; }
}

public class RevenueByHospitalEntryDto
{
    public int HospitalId { get; set; }
    public string HospitalName { get; set; } = string.Empty;
    public double Revenue { get; set; }
    public double SharePercent { get; set; }
}

public class MonthlyTrendEntryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public double Revenue { get; set; }
}

public class SupplementaryKpisDto
{
    public ActiveCustomersDto ActiveCustomers { get; set; } = new();
    public ChurnedCustomersDto ChurnedCustomers { get; set; } = new();
    public ProductPenetrationDto ProductPenetration { get; set; } = new();
    public List<RevenueByHospitalEntryDto> RevenueShareByHospital { get; set; } = new();
    public List<MonthlyTrendEntryDto> MonthlyRevenueTrend { get; set; } = new();
}

public class ActiveCustomersDto
{
    public int Count { get; set; }
    public List<int> HospitalIds { get; set; } = new();
}

public class ChurnedCustomersDto
{
    public int Count { get; set; }
    public List<ChurnedCustomerEntryDto> Hospitals { get; set; } = new();
}

public class ProductPenetrationDto
{
    public double AvgDistinctProductTypesPerCustomer { get; set; }
    public List<ProductTypeGroupSoldDto> ProductTypeGroupsSold { get; set; } = new();
}

public class SalespersonKpiResponse
{
    public SalespersonSummaryDto Salesperson { get; set; } = null!;
    public PeriodKeyDto Period { get; set; } = new();
    public CompositeScoreResultDto Composite { get; set; } = null!;
    public SupplementaryKpisDto Supplementary { get; set; } = null!;
}

public class TeamKpiResultRow
{
    public SalespersonSummaryDto Salesperson { get; set; } = null!;
    public CompositeScoreResultDto Composite { get; set; } = null!;
}

public class TeamKpiResponse
{
    public PeriodKeyDto Period { get; set; } = new();
    public List<TeamKpiResultRow> Results { get; set; } = new();
    public string? Reason { get; set; }
}

// ---------- Drill-down ----------

/// <summary>
/// SalesLine row as the kpi.service.ts drill-down queries return it: every scalar column plus
/// `hospital: { displayName }` always, `product`/`productType` only for some metrics.
/// Prisma Decimal columns serialize as strings.
/// </summary>
public class KpiSalesLineDto
{
    public int Id { get; set; }
    public string InvoiceNo { get; set; } = string.Empty;
    public string? PoNo { get; set; }
    public DateTime InvoiceDate { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int HospitalId { get; set; }
    public int SalespersonId { get; set; }
    public int ProductId { get; set; }
    public int ProductTypeId { get; set; }
    public string? Lot { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? Province { get; set; }
    public string Qty { get; set; } = string.Empty;
    public string UnitPrice { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Vat { get; set; } = string.Empty;
    public string Total { get; set; } = string.Empty;
    public string RowKey { get; set; } = string.Empty;
    public string SourceSheetName { get; set; } = string.Empty;
    public int SourceRowNumber { get; set; }
    public int ImportBatchId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public KpiDrillHospitalDto Hospital { get; set; } = null!;
    public ProductTypeSummaryDto? Product { get; set; }
    public ProductTypeSummaryDto? ProductType { get; set; }
}

public class KpiDrillHospitalDto
{
    public string DisplayName { get; set; } = string.Empty;
}

public class KpiDrillDownResponse
{
    public SalespersonSummaryDto Salesperson { get; set; } = null!;
    public PeriodKeyDto Period { get; set; } = new();
    public string Metric { get; set; } = string.Empty;
    public List<KpiSalesLineDto> SalesLines { get; set; } = new();
    public List<int>? RetainedHospitalIds { get; set; }
    public List<YearMonthDto>? TrailingMonths { get; set; }
    public int? ChurnMonths { get; set; }
}
