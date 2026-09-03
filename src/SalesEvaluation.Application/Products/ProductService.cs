namespace SalesEvaluation.Application.Products;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Products.Models;
using SalesEvaluation.Contracts.Products;
using SalesEvaluation.Domain.Entities;

public class ProductService : IProductService
{
    private readonly IAppDbContext _dbContext;

    public ProductService(IAppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ProductsResponse> ListProductsAsync(CancellationToken cancellationToken = default)
    {
        var products = await _dbContext.Products
            .AsNoTracking()
            .Include(p => p.ProductType)
            .OrderBy(p => p.ProductType.Name)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);

        return new ProductsResponse
        {
            Products = products.Select(MapToDto).ToList()
        };
    }

    public async Task<ProductTypesResponse> ListProductTypesAsync(CancellationToken cancellationToken = default)
    {
        var productTypes = await _dbContext.ProductTypes
            .AsNoTracking()
            .OrderBy(pt => pt.Name)
            .ToListAsync(cancellationToken);

        return new ProductTypesResponse
        {
            ProductTypes = productTypes.Select(pt => new ProductTypeDto
            {
                Id = pt.Id,
                Name = pt.Name
            }).ToList()
        };
    }

    public async Task<ProductResponse> UpdateProductAsync(int id, UpdateProductInputDto input, CancellationToken cancellationToken = default)
    {
        if (!input.HasCode && !input.HasDisplayName && !input.HasIsActive)
        {
            throw new ValidationException("Validation failed", "ต้องระบุอย่างน้อยหนึ่งฟิลด์ (code / displayName / isActive)");
        }

        string? codeToSet = null;
        if (input.HasCode)
        {
            if (input.Code != null)
            {
                var trimmed = input.Code.Trim();
                if (trimmed.Length == 0)
                {
                    throw new ValidationException("Validation failed", "รหัสสินค้าต้องไม่เป็นค่าว่าง");
                }
                codeToSet = trimmed;
            }
        }

        string? displayNameToSet = null;
        if (input.HasDisplayName)
        {
            if (input.DisplayName != null)
            {
                var trimmed = input.DisplayName.Trim();
                if (trimmed.Length == 0)
                {
                    throw new ValidationException("Validation failed", "ชื่อทางการต้องไม่เป็นค่าว่าง");
                }
                displayNameToSet = trimmed;
            }
        }

        var product = await _dbContext.Products
            .Include(p => p.ProductType)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (product == null)
        {
            throw new NotFoundException("Product not found");
        }

        if (input.HasCode)
        {
            if (codeToSet != null)
            {
                var conflict = await _dbContext.Products
                    .AnyAsync(p => p.Id != id && p.Code == codeToSet, cancellationToken);

                if (conflict)
                {
                    throw new ConflictException("รหัสสินค้านี้ถูกใช้กับสินค้าอื่นแล้ว");
                }
            }
            product.Code = codeToSet;
        }

        if (input.HasDisplayName)
        {
            product.DisplayName = displayNameToSet;
        }

        if (input.HasIsActive)
        {
            product.IsActive = input.IsActive;
        }

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // A unique key violation here means the pre-check race was lost.
            // Re-throw as ConflictException so the exception handler maps it to 409.
            throw new ConflictException("รหัสสินค้านี้ถูกใช้กับสินค้าอื่นแล้ว");
        }

        return new ProductResponse
        {
            Product = MapToDto(product)
        };
    }

    private static ProductDto MapToDto(Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Code = product.Code,
            DisplayName = product.DisplayName,
            Source = product.Source.ToString(),
            IsActive = product.IsActive,
            ProductType = product.ProductType == null ? null! : new ProductTypeDto
            {
                Id = product.ProductType.Id,
                Name = product.ProductType.Name
            }
        };
    }
}
