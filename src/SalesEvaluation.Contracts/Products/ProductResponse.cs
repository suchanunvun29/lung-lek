namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class ProductResponse : IContractDto
{
    public ProductDto Product { get; set; } = null!;
}
