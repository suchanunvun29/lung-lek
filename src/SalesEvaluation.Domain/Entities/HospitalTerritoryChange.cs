namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class HospitalTerritoryChange : IDomainEntity
{
    public int Id { get; set; }
    public int? HospitalId { get; set; }
    public int? RegistryId { get; set; }
    public int? FromTerritoryId { get; set; }
    public int? ToTerritoryId { get; set; }
    public int? ChangedById { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
