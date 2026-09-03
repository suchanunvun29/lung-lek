namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;

public class ProductType : IDomainEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<SalesLine> SalesLines { get; set; } = new List<SalesLine>();
    public ICollection<TargetProductGroup> TargetProductGroups { get; set; } = new List<TargetProductGroup>();
}
