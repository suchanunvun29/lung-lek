namespace SalesEvaluation.Contracts.Products;

using SalesEvaluation.Contracts.Common;

public class UpdateProductRequest : IContractDto
{
    public string? Code { get; set; }
    public string? DisplayName { get; set; }
    public bool? IsActive { get; set; }
}
