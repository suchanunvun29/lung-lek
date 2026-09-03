namespace SalesEvaluation.Contracts.Targets;

using SalesEvaluation.Contracts.Common;

public class ProductTypeSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class SalespersonSummaryDto
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

public class TargetProductGroupDto
{
    public int Id { get; set; }
    public int TargetId { get; set; }
    public int ProductTypeId { get; set; }

    /// <summary>Prisma Decimal → JSON string ("150000.00"), same as Express + Prisma.</summary>
    public string RevenueTarget { get; set; } = string.Empty;

    /// <summary>Only present on GET /targets — listTargets includes it, the PUT endpoints don't.</summary>
    public ProductTypeSummaryDto? ProductType { get; set; }
}

public class TargetDto
{
    public int Id { get; set; }

    /// <summary>"SALESPERSON" | "TERRITORY" | "TERRITORY_GROUP".</summary>
    public string Scope { get; set; } = string.Empty;
    public int? TerritoryId { get; set; }
    public int? TerritoryGroupId { get; set; }
    public int? SalespersonId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>Prisma Decimal → JSON string.</summary>
    public string RevenueTarget { get; set; } = string.Empty;
    public int NewCustomerTarget { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<TargetProductGroupDto> ProductGroupTargets { get; set; } = new();

    /// <summary>Only present on GET /targets — listTargets includes it, the PUT endpoints don't.</summary>
    public SalespersonSummaryDto? Salesperson { get; set; }
}

public class TargetsResponse
{
    public List<TargetDto> Targets { get; set; } = new();
}

public class TargetResponse
{
    public TargetDto Target { get; set; } = null!;
}

public class ProductGroupInputDto
{
    public int ProductTypeId { get; set; }
    public decimal RevenueTarget { get; set; }
}

public class ProductGroupTargetsBody
{
    public List<ProductGroupInputDto> ProductGroups { get; set; } = new();
}

public class CopyTargetsBody
{
    public int FromYear { get; set; }
    public int FromMonth { get; set; }
    public int ToYear { get; set; }
    public int ToMonth { get; set; }
    public bool Overwrite { get; set; }
}

public class CopyTargetsResult
{
    public int SourceCount { get; set; }
    public List<int> Created { get; set; } = new();
    public List<int> Updated { get; set; } = new();
    public List<int> Skipped { get; set; } = new();
}

/// <summary>TargetRevision.before/after — plain-number JSON snapshot written by toTargetSnapshot.</summary>
public class TargetRevisionDto
{
    public int Id { get; set; }
    public int TargetId { get; set; }
    public string ChangeType { get; set; } = string.Empty;
    public System.Text.Json.JsonElement? Before { get; set; }
    public System.Text.Json.JsonElement? After { get; set; }
    public int ChangedById { get; set; }
    public UserSummaryDto ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; }
    public string? Note { get; set; }
}

public class TargetRevisionsResponse
{
    public List<TargetRevisionDto> Revisions { get; set; } = new();
}

/// <summary>One contribution line of GET /targets/derived — a TERRITORY or TERRITORY_GROUP target split by active owners.</summary>
public class DerivedTargetContributionDto
{
    public int? TerritoryId { get; set; }
    public int? TerritoryGroupId { get; set; }
    public double RevenueTarget { get; set; }
    public bool? Unassigned { get; set; }
}

public class DerivedTargetDto
{
    public double RevenueTarget { get; set; }
    public double NewCustomerTarget { get; set; }
    public string Source { get; set; } = string.Empty;
    public List<DerivedTargetContributionDto> Items { get; set; } = new();
}

public class DerivedTargetResponse
{
    public DerivedTargetDto DerivedTarget { get; set; } = null!;
}
