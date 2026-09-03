namespace SalesEvaluation.Contracts.Targets;

// ---------- Module L: Area potential & target assist ----------
// Shapes mirror frontend/lib/types.ts Module L. Every number in the preview payload passes
// through Number() on the TS backend, so they are real JSON numbers (double) here.

public class SuggestionSettingsDto
{
    public string PotentialMetric { get; set; } = string.Empty;
    public double MinRegionCoverage { get; set; }
    public double TargetSuggestionAlpha { get; set; }
    public int TargetLookbackMonths { get; set; }
    public double TargetOutlierThreshold { get; set; }

    /// <summary>The value this preview used — the setting's value or a per-round override.</summary>
    public double TargetGrowthRate { get; set; }
}

public class SuggestionWindowDto
{
    public YearMonthDto? Start { get; set; }
    public YearMonthDto? End { get; set; }

    /// <summary>Months inside the window that actually hold data — the divisor (design Risks ข้อ 18).</summary>
    public int MonthsUsed { get; set; }
}

public class YearMonthDto
{
    public int Year { get; set; }
    public int Month { get; set; }
}

public class TerritorySuggestionRowDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string TerritoryName { get; set; } = string.Empty;
    public double Potential { get; set; }
    public double PotentialShare { get; set; }

    /// <summary>null = the unit has no sales at all → coverage cap 0.</summary>
    public double? TerritoryCoverage { get; set; }
    public double HistoryBeforeCut { get; set; }
    public double HistoryAfterCut { get; set; }
    public double HistoryBased { get; set; }
    public double PotentialBased { get; set; }
    public double W { get; set; }
    public double Suggested { get; set; }

    /// <summary>Display-only baht per potential unit — never a percent (Territory & Potential Rules ข้อ 4).</summary>
    public double? PenetrationIndex { get; set; }
}

public class RegionSuggestionGroupDto
{
    public string RegionId { get; set; } = string.Empty;
    public string RegionName { get; set; } = string.Empty;
    public bool CoveragePass { get; set; }

    /// <summary>null = the region has no sales at all.</summary>
    public double? RegionCoverage { get; set; }
    public double R { get; set; }
    public double SuggestedSum { get; set; }
    public double DifferenceFromR { get; set; }
    public List<TerritorySuggestionRowDto> Territories { get; set; } = new();
}

public class UnmappedBaseEntryDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string TerritoryName { get; set; } = string.Empty;
    public double UnmappedBase { get; set; }
    public int UnmappedHospitalCount { get; set; }
}

/// <summary>Σ suggested over every region + unmappedBase — the number "รับข้อเสนอ" writes into Target.</summary>
public class TerritorySuggestedTotalDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string TerritoryName { get; set; } = string.Empty;
    public double SuggestedTotal { get; set; }
}

public class CutDealEntryDto
{
    public string TerritoryId { get; set; } = string.Empty;
    public string TerritoryName { get; set; } = string.Empty;
    public string InvoiceNo { get; set; } = string.Empty;
    public double DealValue { get; set; }
    public double Ratio { get; set; }
}

public class TargetSuggestionPreviewDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Mode { get; set; } = string.Empty;
    public SuggestionSettingsDto Settings { get; set; } = new();
    public SuggestionWindowDto Window { get; set; } = new();
    public List<RegionSuggestionGroupDto> Regions { get; set; } = new();
    public List<UnmappedBaseEntryDto> Unmapped { get; set; } = new();
    public List<TerritorySuggestedTotalDto> Totals { get; set; } = new();
    public List<CutDealEntryDto> CutDeals { get; set; } = new();
}

public class ReinstateDealBody
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Mode { get; set; } = "SUGGEST";
    public List<string> ReinstateInvoiceNos { get; set; } = new();
    public double? TargetGrowthRate { get; set; }
}

public class ReinstateDealResponse : TargetSuggestionPreviewDto
{
    public List<string> ReinstateInvoiceNos { get; set; } = new();
}
