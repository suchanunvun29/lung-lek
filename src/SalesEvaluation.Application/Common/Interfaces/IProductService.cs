namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Application.Products.Models;
using SalesEvaluation.Contracts.Products;

public interface IProductService
{
    Task<ProductsResponse> ListProductsAsync(CancellationToken cancellationToken = default);
    Task<ProductResponse> UpdateProductAsync(int id, UpdateProductInputDto input, CancellationToken cancellationToken = default);
    Task<ProductTypesResponse> ListProductTypesAsync(CancellationToken cancellationToken = default);
}
