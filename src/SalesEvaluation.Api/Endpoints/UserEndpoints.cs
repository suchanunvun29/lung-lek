namespace SalesEvaluation.Api.Endpoints;

using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Users;
using SalesEvaluation.Domain.Enums;

public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /users and GET /api/users
        app.MapGet("/users", HandleListUsers);
        app.MapGet("/api/users", HandleListUsers);

        // POST /users and POST /api/users
        app.MapPost("/users", HandleCreateUser);
        app.MapPost("/api/users", HandleCreateUser);

        // PATCH /users/{id} and PATCH /api/users/{id}
        app.MapPatch("/users/{id}", HandleUpdateUser);
        app.MapPatch("/api/users/{id}", HandleUpdateUser);

        // POST /users/{id}/reset-password and POST /api/users/{id}/reset-password
        app.MapPost("/users/{id}/reset-password", HandleResetPassword);
        app.MapPost("/api/users/{id}/reset-password", HandleResetPassword);

        return app;
    }

    private static async Task<IResult> HandleListUsers(
        IUserService userService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var result = await userService.ListUsersAsync(ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> HandleCreateUser(
        CreateUserRequest request,
        IUserService userService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var result = await userService.CreateUserAsync(request, ct);
        return Results.Json(result, statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> HandleUpdateUser(
        int id,
        HttpContext httpContext,
        IUserService userService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
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

            var request = new UpdateUserRequest();

            if (root.TryGetProperty("displayName", out var dispProp) && dispProp.ValueKind == JsonValueKind.String)
            {
                request.DisplayName = dispProp.GetString();
            }

            if (root.TryGetProperty("role", out var roleProp) && roleProp.ValueKind == JsonValueKind.String)
            {
                if (Enum.TryParse<UserRole>(roleProp.GetString(), out var parsedRole))
                {
                    request.Role = parsedRole.ToString();
                }
            }

            if (root.TryGetProperty("isActive", out var activeProp))
            {
                if (activeProp.ValueKind == JsonValueKind.True || activeProp.ValueKind == JsonValueKind.False)
                {
                    request.IsActive = activeProp.GetBoolean();
                }
            }

            if (root.TryGetProperty("salespersonId", out var spProp))
            {
                request.HasSalespersonId = true;
                if (spProp.ValueKind == JsonValueKind.Null)
                {
                    request.SalespersonId = null;
                }
                else if (spProp.ValueKind == JsonValueKind.Number)
                {
                    request.SalespersonId = spProp.GetInt32();
                }
                else if (spProp.ValueKind == JsonValueKind.String && int.TryParse(spProp.GetString(), out var spId))
                {
                    request.SalespersonId = spId;
                }
            }

            var result = await userService.UpdateUserAsync(id, request, currentUser.Id, ct);
            return Results.Ok(result);
        }
    }

    private static async Task<IResult> HandleResetPassword(
        int id,
        ResetPasswordRequest request,
        IUserService userService,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        if (currentUserService.User?.Role != UserRole.MANAGER)
        {
            return Results.Json(new { error = "Forbidden: insufficient role" }, statusCode: StatusCodes.Status403Forbidden);
        }

        var result = await userService.ResetPasswordAsync(id, request, ct);
        return Results.Ok(result);
    }
}
