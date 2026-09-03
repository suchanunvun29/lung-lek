namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesLineCredit : IDomainEntity
{
    public int Id { get; set; }
    public int SalesLineId { get; set; }
    public SalesLine SalesLine { get; set; } = null!;
    public int SalespersonId { get; set; }
    public Salesperson Salesperson { get; set; } = null!;
    public decimal SharePercent { get; set; }
    public bool IsPrimary { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
