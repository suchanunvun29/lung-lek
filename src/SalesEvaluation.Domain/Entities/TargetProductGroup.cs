namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TargetProductGroup : IDomainEntity
{
    public int Id { get; set; }
    public int TargetId { get; set; }
    public Target Target { get; set; } = null!;
    public int ProductTypeId { get; set; }
    public ProductType ProductType { get; set; } = null!;
    public decimal RevenueTarget { get; set; }
}
