namespace SalesEvaluation.Contracts.Targets;

public static class BulkDistributeMode
{
    public const string AnnualTotal = "ANNUAL_TOTAL";
    public const string MonthlyBase = "MONTHLY_BASE";
}

public static class BulkOverwriteMode
{
    public const string OverwriteAll = "OVERWRITE_ALL";
    public const string KeepCustom = "KEEP_CUSTOM";
}

public class BulkDistributeTargetsRequest
{
    /// <summary>"SALESPERSON" | "TERRITORY"</summary>
    public string Scope { get; set; } = string.Empty;

    /// <summary>SalespersonId or TerritoryId depending on Scope.</summary>
    public int TargetScopeId { get; set; }

    public int Year { get; set; }

    /// <summary>"ANNUAL_TOTAL" | "MONTHLY_BASE"</summary>
    public string Mode { get; set; } = string.Empty;

    public decimal RevenueTarget { get; set; }

    public int? NewCustomerTarget { get; set; }

    public List<ProductGroupInputDto>? ProductGroupTargets { get; set; }

    /// <summary>"OVERWRITE_ALL" | "KEEP_CUSTOM"</summary>
    public string OverwriteMode { get; set; } = BulkOverwriteMode.OverwriteAll;
}

public class BulkDistributeTargetsResult
{
    public int Year { get; set; }
    public string Scope { get; set; } = string.Empty;
    public int TargetScopeId { get; set; }
    public int CreatedCount { get; set; }
    public int UpdatedCount { get; set; }
    public int SkippedCount { get; set; }
    public List<TargetDto> Targets { get; set; } = new();
}
