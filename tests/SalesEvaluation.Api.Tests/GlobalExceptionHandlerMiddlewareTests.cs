namespace SalesEvaluation.Api.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using SalesEvaluation.Api.Middleware;
using SalesEvaluation.Application.Common.Exceptions;
using Xunit;

/// <summary>
/// T-UX-022 — pins the single error envelope {error, code?, details?} produced by
/// GlobalExceptionHandlerMiddleware for every exception family, including the
/// 500 path that must never leak internal exception details.
/// </summary>
public class GlobalExceptionHandlerMiddlewareTests
{
    private static async Task<(int Status, string Body, JsonElement Json)> InvokeAsync(Exception thrown)
    {
        var middleware = new GlobalExceptionHandlerMiddleware(
            _ => throw thrown,
            new TestLogger<GlobalExceptionHandlerMiddleware>());

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync();
        var json = JsonDocument.Parse(body).RootElement.Clone();
        return (context.Response.StatusCode, body, json);
    }

    [Fact]
    public async Task ValidationException_WithDetails_ReturnsErrorAndDetails()
    {
        var (status, _, json) = await InvokeAsync(new ValidationException("Validation failed", "revenueTarget must be >= 0"));

        Assert.Equal(400, status);
        Assert.Equal("Validation failed", json.GetProperty("error").GetString());
        Assert.Equal("revenueTarget must be >= 0", json.GetProperty("details").GetString());
        Assert.Equal(2, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task ValidationException_WithoutDetails_ReturnsErrorOnly()
    {
        var (status, _, json) = await InvokeAsync(new ValidationException("Validation failed"));

        Assert.Equal(400, status);
        Assert.Equal("Validation failed", json.GetProperty("error").GetString());
        Assert.False(json.TryGetProperty("details", out _));
        Assert.Equal(1, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task UnauthorizedException_ReturnsErrorOnly()
    {
        var (status, _, json) = await InvokeAsync(new UnauthorizedException("Invalid or expired token"));

        Assert.Equal(401, status);
        Assert.Equal("Invalid or expired token", json.GetProperty("error").GetString());
        Assert.False(json.TryGetProperty("code", out _));
        Assert.Equal(1, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task ForbiddenException_WithCode_ReturnsErrorAndCode()
    {
        var (status, _, json) = await InvokeAsync(new ForbiddenException("Password change required", "MUST_CHANGE_PASSWORD"));

        Assert.Equal(403, status);
        Assert.Equal("Password change required", json.GetProperty("error").GetString());
        Assert.Equal("MUST_CHANGE_PASSWORD", json.GetProperty("code").GetString());
        Assert.Equal(2, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task ForbiddenException_WithoutCode_ReturnsErrorOnly()
    {
        var (status, _, json) = await InvokeAsync(new ForbiddenException("Forbidden: insufficient role"));

        Assert.Equal(403, status);
        Assert.Equal("Forbidden: insufficient role", json.GetProperty("error").GetString());
        Assert.False(json.TryGetProperty("code", out _));
    }

    [Fact]
    public async Task NotFoundException_ReturnsErrorOnly()
    {
        var (status, _, json) = await InvokeAsync(new NotFoundException("Hospital not found"));

        Assert.Equal(404, status);
        Assert.Equal("Hospital not found", json.GetProperty("error").GetString());
        Assert.Equal(1, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task ConflictException_WithCode_ReturnsErrorAndCode()
    {
        var (status, _, json) = await InvokeAsync(new ConflictException("Hospital alias with key 'X' already exists", "ALIAS_DUPLICATE"));

        Assert.Equal(409, status);
        Assert.Equal("Hospital alias with key 'X' already exists", json.GetProperty("error").GetString());
        Assert.Equal("ALIAS_DUPLICATE", json.GetProperty("code").GetString());
        Assert.Equal(2, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task ConflictException_WithoutCode_ReturnsErrorOnly()
    {
        var (status, _, json) = await InvokeAsync(new ConflictException("รายการนี้ถูกตัดสินไปแล้ว"));

        Assert.Equal(409, status);
        Assert.Equal("รายการนี้ถูกตัดสินไปแล้ว", json.GetProperty("error").GetString());
        Assert.False(json.TryGetProperty("code", out _));
        Assert.Equal(1, json.EnumerateObject().Count());
    }

    [Fact]
    public async Task UnknownException_ReturnsGeneric500WithoutInternalDetails()
    {
        var (status, body, json) = await InvokeAsync(new InvalidOperationException("EvaluationSetting singleton row is missing — internal secret detail"));

        Assert.Equal(500, status);
        Assert.Equal("Internal server error", json.GetProperty("error").GetString());
        Assert.Equal(1, json.EnumerateObject().Count());
        Assert.DoesNotContain("singleton", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("internal secret detail", body, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class TestLogger<T> : Microsoft.Extensions.Logging.ILogger<T>
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => false;

        public void Log<TState>(
            Microsoft.Extensions.Logging.LogLevel logLevel,
            Microsoft.Extensions.Logging.EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
        }
    }
}
