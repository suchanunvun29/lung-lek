namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class SalesmanNameRuleMember : IDomainEntity
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public SalesmanNameRule Rule { get; set; } = null!;
    public int SalespersonId { get; set; }
    public Salesperson Salesperson { get; set; } = null!;
    public decimal SharePercent { get; set; }
}
