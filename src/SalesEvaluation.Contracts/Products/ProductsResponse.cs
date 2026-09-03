namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class ProductsResponse : IContractDto
{
    public List<ProductDto> Products { get; set; } = new();
}
