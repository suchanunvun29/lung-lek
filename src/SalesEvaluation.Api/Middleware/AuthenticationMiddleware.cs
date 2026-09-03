namespace SalesEvaluation.Api.Middleware;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;

public class AuthenticationMiddleware
{
    private readonly RequestDelegate _next;
    private const string BearerPrefix = "Bearer ";

    public AuthenticationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IJwtTokenProvider jwtTokenProvider, IAppDbContext dbContext)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Skip health check and login endpoints
        if (path.Equals("/health", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/auth/login", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Check Authorization header
        if (!context.Request.Headers.TryGetValue("Authorization", out var authHeaders) ||
            string.IsNullOrWhiteSpace(authHeaders))
        {
            await WriteJsonErrorAsync(context, StatusCodes.Status401Unauthorized, "Missing or invalid Authorization header");
            return;
        }

        var header = authHeaders.ToString();
        if (!header.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            await WriteJsonErrorAsync(context, StatusCodes.Status401Unauthorized, "Missing or invalid Authorization header");
            return;
        }

        var token = header.Substring(BearerPrefix.Length).Trim();
        var validationResult = jwtTokenProvider.ValidateToken(token);
        if (validationResult == null)
        {
            await WriteJsonErrorAsync(context, StatusCodes.Status401Unauthorized, "Invalid or expired token");
            return;
        }

        var (userId, tokenRole) = validationResult.Value;

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null || !user.IsActive)
        {
            await WriteJsonErrorAsync(context, StatusCodes.Status401Unauthorized, "User not found or inactive");
            return;
        }

        var currentUser = new CurrentUser
        {
            Id = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            Role = user.Role,
            MustChangePassword = user.MustChangePassword,
            IsActive = user.IsActive
        };

        context.Items["CurrentUser"] = currentUser;

        var claims = new[]
        {
            new Claim("sub", user.Id),
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim("role", user.Role.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.DisplayName)
        };

        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));

        // Must change password gate
        var isChangePasswordPath = path.StartsWith("/auth/change-password", StringComparison.OrdinalIgnoreCase) ||
                                   path.StartsWith("/api/auth/change-password", StringComparison.OrdinalIgnoreCase);

        if (user.MustChangePassword && !isChangePasswordPath)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            var payload = new { error = "Password change required", code = "MUST_CHANGE_PASSWORD" };
            await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
            return;
        }

        await _next(context);
    }

    private static async Task WriteJsonErrorAsync(HttpContext context, int statusCode, string message)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;
        var payload = new { error = message };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
