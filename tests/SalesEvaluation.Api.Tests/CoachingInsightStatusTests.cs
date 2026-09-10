namespace SalesEvaluation.Api.Tests;

// T-UX-028 — coaching status transparency. The IGeminiService dependency is replaced with
// deterministic stubs so the tests don't touch the network: a throwing stub stands in for
// "AI unavailable" and a value-returning stub for the success path.

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Persistence;
using Xunit;

public class CoachingInsightStatusTests
{
    private sealed class ThrowingGeminiService : IGeminiService
    {
        // Same shape GeminiApiClient throws on a 429 — including raw provider detail that
        // must never leave the API.
        public Task<GeminiResult> CallAsync(string prompt, CancellationToken cancellationToken = default)
            => throw new HttpRequestException(
                "Gemini API ตอบกลับผิดพลาด (429): {\"error\":{\"code\":429,\"status\":\"RESOURCE_EXHAUSTED\"}}");
    }

    private sealed class StubGeminiService : IGeminiService
    {
        public Task<GeminiResult> CallAsync(string prompt, CancellationToken cancellationToken = default)
            => Task.FromResult(new GeminiResult("คำแนะนำจาก AI ทดสอบ", "gemini-test-model"));
    }

    private static WebApplicationFactory<Program> NewFactory(IGeminiService gemini)
        => new CustomWebApplicationFactory().WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGeminiService>();
                services.AddSingleton(gemini);
            }));

    private static string ManagerToken(WebApplicationFactory<Program> factory)
    {
        using var scope = factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<IJwtTokenProvider>().GenerateToken(1, UserRole.MANAGER);
    }

    private static HttpRequestMessage JsonRequest(HttpMethod method, string path, object body, WebApplicationFactory<Program> factory)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ManagerToken(factory));
        return request;
    }

    private static object MonthBody => new { periodType = "MONTH", year = 2026, periodNumber = 1 };

    [Fact]
    public async Task Generate_WhenAiFails_Returns201WithFailedStatusAndThaiReason_NoRawError()
    {
        using var factory = NewFactory(new ThrowingGeminiService());
        var client = factory.CreateClient();

        using var request = JsonRequest(HttpMethod.Post, "/coaching-insights/1/generate", MonthBody, factory);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var insight = json.GetProperty("insight");
        Assert.Equal("FAILED", insight.GetProperty("status").GetString());
        Assert.Null(insight.GetProperty("provider").GetString());

        // ข้อความไทยหมวดเดียวกันทั้งสอง field — ไม่มี raw "(429)" หรือ provider payload หลุด
        var reason = insight.GetProperty("fallbackReason").GetString();
        Assert.False(string.IsNullOrWhiteSpace(reason));
        Assert.Equal("AI ถูกจำกัดการใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง", reason);
        Assert.Equal(reason, insight.GetProperty("errorMessage").GetString());
        Assert.DoesNotContain("429", insight.GetProperty("errorMessage").GetString());
        Assert.DoesNotContain("RESOURCE_EXHAUSTED", insight.GetProperty("errorMessage").GetString());

        // contentTh = rule-based fallback (ไม่ว่าง)
        Assert.False(string.IsNullOrWhiteSpace(insight.GetProperty("contentTh").GetString()));

        // GET อ่านกลับมาต้องเห็นสถานะตรงกัน (raw ยังถูกกันอยู่)
        using var getRequest = new HttpRequestMessage(
            HttpMethod.Get, "/coaching-insights/1?periodType=MONTH&year=2026&periodNumber=1");
        getRequest.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer", ManagerToken(factory));
        var getResponse = await client.SendAsync(getRequest);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var getJson = await getResponse.Content.ReadFromJsonAsync<JsonElement>();
        var getInsight = getJson.GetProperty("insight");
        Assert.Equal("FAILED", getInsight.GetProperty("status").GetString());
        Assert.Equal("AI ถูกจำกัดการใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง", getInsight.GetProperty("fallbackReason").GetString());
        Assert.DoesNotContain("429", getInsight.GetProperty("errorMessage").GetString());

        // ของจริง (raw) ยังเก็บใน DB ไว้ให้ log/debug — แค่ไม่ออกนอก API
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.CoachingInsights.SingleAsync(ci => ci.SalespersonId == 1);
        Assert.Contains("429", stored.ErrorMessage);
    }

    [Fact]
    public async Task Generate_WhenAiSucceeds_ReturnsSuccessWithoutFallbackReason()
    {
        using var factory = NewFactory(new StubGeminiService());
        var client = factory.CreateClient();

        using var request = JsonRequest(HttpMethod.Post, "/coaching-insights/1/generate", MonthBody, factory);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var insight = json.GetProperty("insight");
        Assert.Equal("SUCCESS", insight.GetProperty("status").GetString());
        Assert.Equal("gemini", insight.GetProperty("provider").GetString());
        Assert.Equal("คำแนะนำจาก AI ทดสอบ", insight.GetProperty("contentTh").GetString());
        Assert.Null(insight.GetProperty("fallbackReason").GetString());
        Assert.Null(insight.GetProperty("errorMessage").GetString());
    }

    [Fact]
    public async Task Generate_WhenAiDisabled_RuleBasedSuccessIsNotFallback()
    {
        using var factory = NewFactory(new ThrowingGeminiService());
        var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var settings = await db.EvaluationSettings.SingleAsync();
            settings.AiEnabled = false;
            db.SaveChanges();
        }

        using var request = JsonRequest(HttpMethod.Post, "/coaching-insights/1/generate", MonthBody, factory);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var insight = json.GetProperty("insight");
        Assert.Equal("SUCCESS", insight.GetProperty("status").GetString());
        Assert.Equal("rule-based", insight.GetProperty("provider").GetString());
        Assert.Null(insight.GetProperty("fallbackReason").GetString());
    }

    [Fact]
    public async Task Generate_WithInvalidPeriodNumber_Returns400WithSharedThaiMessage()
    {
        using var factory = NewFactory(new StubGeminiService());
        var client = factory.CreateClient();

        using var request = JsonRequest(
            HttpMethod.Post, "/coaching-insights/1/generate",
            new { periodType = "MONTH", year = 2026, periodNumber = 13 }, factory);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)",
            json.GetProperty("details").GetString());
    }
}
