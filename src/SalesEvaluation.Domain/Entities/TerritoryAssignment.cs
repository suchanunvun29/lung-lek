namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TerritoryAssignment : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string TerritoryId { get; set; } = string.Empty;
    public Territory Territory { get; set; } = null!;
    public string SalespersonId { get; set; } = string.Empty;
    public Salesperson Salesperson { get; set; } = null!;
    public bool IsSupervisor { get; set; } = false;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string? AssignedById { get; set; }
    public User? AssignedBy { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
