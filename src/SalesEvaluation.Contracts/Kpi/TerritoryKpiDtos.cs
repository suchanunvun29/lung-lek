namespace SalesEvaluation.Contracts.Kpi;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Targets;

// ---------- Module N: Territory KPI ----------
// Two serialized row shapes exist (Data Visibility Rules ข้อ 6): TERRITORY_FULL carries the
// whole computation, TERRITORY_RANK_ONLY carries exactly the whitelist — never null-padded.

public class TerritoryKpiFullRowDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> OwnerNames { get; set; } = new();
    public double Revenue { get; set; }
    public double? Target { get; set; }

    /// <summary>"ไม่ได้ตั้งเป้าแยก (อยู่ในเป้ารวมของกลุ่ม X)" for a TerritoryGroup member, else null.</summary>
    public string? TargetLabel { get; set; }
    public double? AchievementPercent { get; set; }
    public double? CompositeScore { get; set; }
    public string ComputedMetricLabel { get; set; } = string.Empty;

    /// <summary>Set when compositeScore is null — shown in place of the score.</summary>
    public string? Message { get; set; }
    public List<MetricResultDto> Metrics { get; set; } = new();
    public string Visibility => "TERRITORY_FULL";
    public int Rank { get; set; }
}

public class TerritoryKpiRankOnlyRowDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> OwnerNames { get; set; } = new();
    public double? CompositeScore { get; set; }
    public string ComputedMetricLabel { get; set; } = string.Empty;
    public string Visibility => "TERRITORY_RANK_ONLY";
    public int Rank { get; set; }
}

public class TerritoryPersonalBucketEntryDto
{
    public string SalespersonId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public double Revenue { get; set; }
    public double PersonalTarget { get; set; }
    public double? AchievementPercent { get; set; }
}

/// <summary>Territory KPI Rules ข้อ 3 three-bucket equation chunks — Σ territories + personal + unassigned = companyTotal.</summary>
public class TerritoryKpiBucketsDto
{
    public double CompanyTotal { get; set; }
    public double TerritorySum { get; set; }
    public double PersonalBucket { get; set; }
    public double UnassignedBucket { get; set; }
    public List<TerritoryPersonalBucketEntryDto> PersonalBucketEntries { get; set; } = new();
    public int UnassignedHospitalCount { get; set; }
}

public class TerritoryKpiTeamResponse
{
    public PeriodKeyDto Period { get; set; } = new();
    public List<object> Territories { get; set; } = new();
    public TerritoryKpiBucketsDto? Buckets { get; set; }
}

public class TerritoryKpiSingleResponse
{
    public PeriodKeyDto Period { get; set; } = new();
    public object? Territory { get; set; }
}

public class TerritoryGroupKpiFullRowDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> OwnerNames { get; set; } = new();
    public List<string> MemberTerritoryIds { get; set; } = new();
    public int Rank { get; set; }
    public double Revenue { get; set; }
    public double? RevenueTarget { get; set; }
    public double? AchievementPercent { get; set; }
    public double? CompositeScore { get; set; }
    public string ComputedMetricLabel { get; set; } = string.Empty;
    public string Visibility => "TERRITORY_FULL";
}

public class TerritoryGroupKpiRankOnlyRowDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<string> OwnerNames { get; set; } = new();
    public double? CompositeScore { get; set; }
    public string ComputedMetricLabel { get; set; } = string.Empty;
    public int Rank { get; set; }
    public string Visibility => "TERRITORY_RANK_ONLY";
}

public class TerritoryDrillDownTerritoryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class TerritoryDrillDownEntryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public double Revenue { get; set; }
}

public class TerritoryKpiDrillDownResponse
{
    public TerritoryDrillDownTerritoryDto Territory { get; set; } = null!;
    public string Metric { get; set; } = string.Empty;
    public List<TerritoryDrillDownEntryDto> ProductTypes { get; set; } = new();
    public List<TerritoryDrillDownEntryDto> Hospitals { get; set; } = new();
}
