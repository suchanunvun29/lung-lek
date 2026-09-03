namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class HospitalTerritoryChange : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string? HospitalId { get; set; }
    public string? RegistryId { get; set; }
    public string? FromTerritoryId { get; set; }
    public string? ToTerritoryId { get; set; }
    public string? ChangedById { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
