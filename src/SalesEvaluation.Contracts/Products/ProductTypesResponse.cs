namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class ProductTypesResponse : IContractDto
{
    public List<ProductTypeDto> ProductTypes { get; set; } = new();
}
