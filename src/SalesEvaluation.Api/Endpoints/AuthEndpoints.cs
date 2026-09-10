namespace SalesEvaluation.Api.Endpoints;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SalesEvaluation.Api.Auth;
using SalesEvaluation.Application.Common.Exceptions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Contracts.Auth;

public static class AuthEndpoints
{
    private const string RateLimitedMessage = "พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // POST /auth/login and POST /api/auth/login (public)
        app.MapPost("/auth/login", HandleLogin);

        app.MapPost("/api/auth/login", HandleLogin);

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

    // T-UX-024 — soft login rate limiting: count failed attempts per email+IP in
    // memory; 5 failures inside the window answer 429 before the credential check.
    // Never logs or stores the password; the 401 envelope is unchanged.
    private static async Task<IResult> HandleLogin(
        LoginRequest request,
        IAuthService authService,
        ILoginRateLimiter rateLimiter,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var email = request.Email ?? string.Empty;
        var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();

        if (rateLimiter.IsBlocked(email, ipAddress))
        {
            return Results.Json(
                new { error = RateLimitedMessage, code = "RATE_LIMITED" },
                statusCode: StatusCodes.Status429TooManyRequests);
        }

        try
        {
            var result = await authService.LoginAsync(request, ct);
            rateLimiter.RecordSuccess(email, ipAddress);
            return Results.Ok(result);
        }
        catch (UnauthorizedException)
        {
            rateLimiter.RecordFailure(email, ipAddress);
            throw;
        }
    }
}
