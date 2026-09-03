namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class ProductTypeDto : IContractDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
