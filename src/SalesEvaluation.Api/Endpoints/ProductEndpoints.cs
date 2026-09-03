namespace SalesEvaluation.Api.Endpoints;

using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Products.Models;
using SalesEvaluation.Domain.Enums;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /products and GET /api/products
        // Authentication is enforced by the pipeline-level AuthenticationMiddleware.
        app.MapGet("/products", async (IProductService productService, CancellationToken ct) =>
        {
            var response = await productService.ListProductsAsync(ct);
            return Results.Ok(response);
        });

        app.MapGet("/api/products", async (IProductService productService, CancellationToken ct) =>
        {
            var response = await productService.ListProductsAsync(ct);
            return Results.Ok(response);
        });

        // GET /product-types and GET /api/product-types
        app.MapGet("/product-types", async (IProductService productService, CancellationToken ct) =>
        {
            var response = await productService.ListProductTypesAsync(ct);
            return Results.Ok(response);
        });

        app.MapGet("/api/product-types", async (IProductService productService, CancellationToken ct) =>
        {
            var response = await productService.ListProductTypesAsync(ct);
            return Results.Ok(response);
        });

        // PATCH /products/{id} and PATCH /api/products/{id}
        app.MapPatch("/products/{id}", HandleUpdateProduct);
        app.MapPatch("/api/products/{id}", HandleUpdateProduct);

        return app;
    }

    private static async Task<IResult> HandleUpdateProduct(
        int id,
        HttpContext httpContext,
        IProductService productService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        // Authorization: MANAGER role only (authentication already verified by middleware)
        var currentUser = currentUserService.User;
        if (currentUser == null || currentUser.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        JsonDocument doc;
        try
        {
            doc = await JsonDocument.ParseAsync(httpContext.Request.Body, cancellationToken: ct);
        }
        catch
        {
            return Results.Json(new { error = "Validation failed", details = "Invalid JSON payload" }, statusCode: StatusCodes.Status400BadRequest);
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Results.Json(new { error = "Validation failed", details = "Payload must be a JSON object" }, statusCode: StatusCodes.Status400BadRequest);
            }

            var input = new UpdateProductInputDto();

            if (root.TryGetProperty("code", out var codeProp))
            {
                input.HasCode = true;
                if (codeProp.ValueKind == JsonValueKind.Null)
                {
                    input.Code = null;
                }
                else if (codeProp.ValueKind == JsonValueKind.String)
                {
                    input.Code = codeProp.GetString();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "code must be a string or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("displayName", out var dispProp))
            {
                input.HasDisplayName = true;
                if (dispProp.ValueKind == JsonValueKind.Null)
                {
                    input.DisplayName = null;
                }
                else if (dispProp.ValueKind == JsonValueKind.String)
                {
                    input.DisplayName = dispProp.GetString();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "displayName must be a string or null" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            if (root.TryGetProperty("isActive", out var activeProp))
            {
                input.HasIsActive = true;
                if (activeProp.ValueKind == JsonValueKind.True || activeProp.ValueKind == JsonValueKind.False)
                {
                    input.IsActive = activeProp.GetBoolean();
                }
                else
                {
                    return Results.Json(new { error = "Validation failed", details = "isActive must be a boolean" }, statusCode: StatusCodes.Status400BadRequest);
                }
            }

            var result = await productService.UpdateProductAsync(id, input, ct);
            return Results.Ok(result);
        }
    }
}
