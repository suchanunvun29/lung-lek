namespace SalesEvaluation.Api.Endpoints;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // POST /auth/login and POST /api/auth/login (public)
        app.MapPost("/auth/login", async (LoginRequest request, IAuthService authService, CancellationToken ct) =>
        {
            var result = await authService.LoginAsync(request, ct);
            return Results.Ok(result);
        });

        app.MapPost("/api/auth/login", async (LoginRequest request, IAuthService authService, CancellationToken ct) =>
        {
            var result = await authService.LoginAsync(request, ct);
            return Results.Ok(result);
        });

        // POST /auth/change-password and POST /api/auth/change-password
        app.MapPost("/auth/change-password", async (
            ChangePasswordRequest request,
            IAuthService authService,
            ICurrentUserService currentUserService,
            CancellationToken ct) =>
        {
            if (currentUserService.User == null)
            {
                return Results.Json(new { error = "Unauthorized" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await authService.ChangePasswordAsync(currentUserService.User.Id, request, ct);
            return Results.Ok(result);
        });

        app.MapPost("/api/auth/change-password", async (
            ChangePasswordRequest request,
            IAuthService authService,
            ICurrentUserService currentUserService,
            CancellationToken ct) =>
        {
            if (currentUserService.User == null)
            {
                return Results.Json(new { error = "Unauthorized" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await authService.ChangePasswordAsync(currentUserService.User.Id, request, ct);
            return Results.Ok(result);
        });

        // GET /auth/me and GET /api/auth/me
        app.MapGet("/auth/me", async (
            IAuthService authService,
            ICurrentUserService currentUserService,
            CancellationToken ct) =>
        {
            if (currentUserService.User == null)
            {
                return Results.Json(new { error = "Unauthorized" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await authService.GetMeAsync(currentUserService.User.Id, ct);
            return Results.Ok(result);
        });

        app.MapGet("/api/auth/me", async (
            IAuthService authService,
            ICurrentUserService currentUserService,
            CancellationToken ct) =>
        {
            if (currentUserService.User == null)
            {
                return Results.Json(new { error = "Unauthorized" }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var result = await authService.GetMeAsync(currentUserService.User.Id, ct);
            return Results.Ok(result);
        });

        return app;
    }
}
