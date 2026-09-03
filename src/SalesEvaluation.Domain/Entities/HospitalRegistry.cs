namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class HospitalRegistry : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string? SourceCode { get; set; }
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? ProvinceMappingId { get; set; }
    public ProvinceMapping? ProvinceMapping { get; set; }
    public string ProvinceRaw { get; set; } = string.Empty;
    public string? RegionId { get; set; }
    public Region? Region { get; set; }
    public string? HealthZone { get; set; }
    public string? Tier { get; set; }
    public HospitalCategory Category { get; set; } = HospitalCategory.GOVERNMENT_GENERAL;
    public decimal PotentialAdjustment { get; set; } = 1.000m;
    public bool IsActive { get; set; } = true;
    public string? SourceFile { get; set; }
    public string? TerritoryId { get; set; }
    public Territory? Territory { get; set; }
    public TerritoryLinkSource TerritorySource { get; set; } = TerritoryLinkSource.INFERRED;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<HospitalPotentialMetric> Metrics { get; set; } = new List<HospitalPotentialMetric>();
    public ICollection<HospitalRegistryLink> Links { get; set; } = new List<HospitalRegistryLink>();
}
