namespace SalesEvaluation.Contracts.Kpi;

using SalesEvaluation.Contracts.Common;
using SalesEvaluation.Contracts.Targets;
using System.Text.Json.Serialization;

// ---------- Module O: territory product ranking ----------
// Shapes mirror frontend/lib/types.ts. `code` null serializes as "—" — never null/raw id (ข้อ 3).

public class TerritoryProductRankingItemDto
{
    public int ProductId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ProductTypeSummaryDto ProductType { get; set; } = null!;
    public double Revenue { get; set; }
    public double Quantity { get; set; }

    /// <summary>"SOLD_BEFORE_NOT_IN_PERIOD" | "NEVER_SOLD_IN_TERRITORY" | null.</summary>
    public string? ZeroSaleStatus { get; set; }
}

/// <summary>personalBucket rows carry no zeroSaleStatus (Omit&lt;..., "zeroSaleStatus"&gt; on the frontend).</summary>
public class TerritoryPersonalBucketItemDto
{
    public int ProductId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ProductTypeSummaryDto ProductType { get; set; } = null!;
    public double Revenue { get; set; }
    public double Quantity { get; set; }
}

public class TerritoryProductRankingTerritoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<string> OwnerNames { get; set; } = new();
}

public class TerritoryProductRankingResponse
{
    public PeriodKeyDto Period { get; set; } = new();
    public TerritoryProductRankingTerritoryDto Territory { get; set; } = null!;
    public List<TerritoryProductRankingItemDto> Items { get; set; } = new();
    public string ZeroSaleWarning { get; set; } = string.Empty;

    /// <summary>MANAGER-only (Data Visibility Rules ข้อ 6) — stripped before sending to anyone else.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<TerritoryPersonalBucketItemDto>? PersonalBucket { get; set; }
}
