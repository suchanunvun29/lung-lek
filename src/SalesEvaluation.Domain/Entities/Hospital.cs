namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class Hospital : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string NameInFile { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Province { get; set; }
    public bool IsPreExistingCustomer { get; set; } = false;
    public string? TerritoryId { get; set; }
    public Territory? Territory { get; set; }
    public TerritoryLinkSource TerritorySource { get; set; } = TerritoryLinkSource.INFERRED;
    public string? ProvinceMappingId { get; set; }
    public ProvinceMapping? ProvinceMapping { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public HospitalRegistryLink? RegistryLink { get; set; }
    public ICollection<SalesLine> SalesLines { get; set; } = new List<SalesLine>();
    public ICollection<HospitalAlias> Aliases { get; set; } = new List<HospitalAlias>();
    public ICollection<HospitalNameReview> NameReviews { get; set; } = new List<HospitalNameReview>();
}
