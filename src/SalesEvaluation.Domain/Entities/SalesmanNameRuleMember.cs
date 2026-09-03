namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesmanNameRuleMember : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string RuleId { get; set; } = string.Empty;
    public SalesmanNameRule Rule { get; set; } = null!;
    public string SalespersonId { get; set; } = string.Empty;
    public Salesperson Salesperson { get; set; } = null!;
    public decimal SharePercent { get; set; }
}
