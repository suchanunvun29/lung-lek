namespace SalesEvaluation.Application.Products.Models;

public class UpdateProductInputDto
{
    public bool HasCode { get; set; }
    public string? Code { get; set; }

    public bool HasDisplayName { get; set; }
    public string? DisplayName { get; set; }

    public bool HasIsActive { get; set; }
    public bool IsActive { get; set; }
}
