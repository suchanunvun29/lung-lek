namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class TargetProductGroup : IDomainEntity
{
    public string Id { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public Target Target { get; set; } = null!;
    public string ProductTypeId { get; set; } = string.Empty;
    public ProductType ProductType { get; set; } = null!;
    public decimal RevenueTarget { get; set; }
}
