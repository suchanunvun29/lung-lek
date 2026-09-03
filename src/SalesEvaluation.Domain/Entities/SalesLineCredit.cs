namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesLineCredit : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string SalesLineId { get; set; } = string.Empty;
    public SalesLine SalesLine { get; set; } = null!;
    public string SalespersonId { get; set; } = string.Empty;
    public Salesperson Salesperson { get; set; } = null!;
    public decimal SharePercent { get; set; }
    public bool IsPrimary { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
