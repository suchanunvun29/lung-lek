namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class ProductDto : IContractDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? DisplayName { get; set; }
    public string Source { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public ProductTypeDto ProductType { get; set; } = null!;
}
