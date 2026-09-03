namespace SalesEvaluation.Domain.Entities;

using SalesEvaluation.Domain.Common;
using SalesEvaluation.Domain.Enums;

public class Product : IDomainEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int ProductTypeId { get; set; }
    public ProductType ProductType { get; set; } = null!;
    public string? Code { get; set; }
    public string? DisplayName { get; set; }
    public ProductSource Source { get; set; } = ProductSource.SALES_HISTORY;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesLine> SalesLines { get; set; } = new List<SalesLine>();
    public ICollection<ProductAlias> Aliases { get; set; } = new List<ProductAlias>();
}
