namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TerritoryAssignment : IDomainEntity
{
    public int Id { get; set; }
    public int TerritoryId { get; set; }
    public Territory Territory { get; set; } = null!;
    public int SalespersonId { get; set; }
    public Salesperson Salesperson { get; set; } = null!;
    public bool IsSupervisor { get; set; } = false;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public int? AssignedById { get; set; }
    public User? AssignedBy { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
