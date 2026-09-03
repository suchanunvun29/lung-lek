namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class ProductTypeDto : IContractDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
