namespace SalesEvaluation.Api.Tests;

// T-UX-029 — backend contract hygiene:
// 1. Period: every endpoint family (report, coaching, territory view) parses periods through
//    PeriodQueryParser — same range rules, same Thai message.
// 2. Route prefix: bare paths are canonical; /api/* exists only as documented legacy
//    aliases (auth, users, products, salespeople, hospitals, review queues) and always has
//    a bare sibling (decision recorded in Program.cs).
// 3. mustChangePassword: stays blocked on every non-change-password endpoint, with
//    {error, code:"MUST_CHANGE_PASSWORD"} on all of them (FE T-UX-001 redirects on it).

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class ContractHygieneTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string ThaiRangeMessage = "periodNumber ไม่ถูกต้องสำหรับ periodType นี้ (MONTH: 1-12, QUARTER: 1-4)";

    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ContractHygieneTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private HttpRequestMessage Get(string path, UserRole role = UserRole.MANAGER, int userId = 1)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _factory.CreateToken(userId, role));
        return request;
    }

    private async Task<JsonElement> SendJsonAsync(HttpRequestMessage request)
    {
        var response = await _client.SendAsync(request);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json;
    }

    // ── Period: เกณฑ์และข้อความเดียวกันทุก endpoint family ──

    private static readonly string[] PeriodEndpoints =
    [
        "/reports/individual/1",
        "/reports/team-overview",
        "/coaching-insights/1",
        "/my-territory-view/1",
    ];

    [Theory]
    [MemberData(nameof(PeriodEndpointsData))]
    public async Task Period_ValidMonth_AcceptedEverywhere(string endpoint)
    {
        var json = await SendJsonAsync(Get($"{endpoint}?periodType=MONTH&year=2026&periodNumber=1"));
        Assert.True(json.ValueKind != JsonValueKind.Object || !json.TryGetProperty("error", out _),
            $"expected success but got error: {json.GetRawText()}");
    }

    public static TheoryData<string> PeriodEndpointsData() => new(PeriodEndpoints);

    [Theory]
    [MemberData(nameof(PeriodEndpointsData))]
    public async Task Period_MonthOutOfRange_SameThaiMessageEverywhere(string endpoint)
    {
        var response = await _client.SendAsync(Get($"{endpoint}?periodType=MONTH&year=2026&periodNumber=13"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Validation failed", json.GetProperty("error").GetString());
        Assert.Equal(ThaiRangeMessage, json.GetProperty("details").GetString());
    }

    [Theory]
    [MemberData(nameof(PeriodEndpointsData))]
    public async Task Period_QuarterOutOfRange_SameThaiMessageEverywhere(string endpoint)
    {
        var response = await _client.SendAsync(Get($"{endpoint}?periodType=QUARTER&year=2026&periodNumber=5"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ThaiRangeMessage, json.GetProperty("details").GetString());
    }

    [Theory]
    [MemberData(nameof(PeriodEndpointsData))]
    public async Task Period_MonthMissingPeriodNumber_RejectedEverywhere(string endpoint)
    {
        var response = await _client.SendAsync(Get($"{endpoint}?periodType=MONTH&year=2026"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ThaiRangeMessage, json.GetProperty("details").GetString());
    }

    [Theory]
    [MemberData(nameof(PeriodEndpointsData))]
    public async Task Period_YearOmittedPeriodNumber_NormalizedEverywhere(string endpoint)
    {
        // FE (periodQueryParams) omits periodNumber for YEAR — every family must accept and
        // normalize to 0. This was previously a 400 on report/coaching (their own loose
        // parsers required the parameter) and is now the unified contract.
        var json = await SendJsonAsync(Get($"{endpoint}?periodType=YEAR&year=2026"));
        Assert.True(json.ValueKind != JsonValueKind.Object || !json.TryGetProperty("error", out _),
            $"expected success but got error: {json.GetRawText()}");
    }

    [Fact]
    public async Task CoachingGenerate_YearWithAnyPeriodNumber_NormalizesToZero()
    {
        var body = new { periodType = "YEAR", year = 2026, periodNumber = 99 };
        var response = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/coaching-insights/1/generate")
        {
            Content = JsonContent.Create(body),
            Headers = { { "Authorization", new AuthenticationHeaderValue("Bearer", _factory.CreateToken(1, UserRole.MANAGER)).ToString() } },
        });

        // AI is unreachable in the test host → the insight lands as FAILED fallback, but the
        // contract point is the period: it must NOT be a 400 and YEAR keeps periodNumber 0.
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var insight = json.GetProperty("insight");
        Assert.Equal("YEAR", insight.GetProperty("periodType").GetString());
        Assert.Equal(0, insight.GetProperty("periodNumber").GetInt32());
    }

    // ── Route prefix: bare canonical, /api เป็น alias ชุดเดิมเท่านั้น และต้องมี bare คู่กัน ──

    [Fact]
    public void ApiPrefixedRoutes_AreDocumentedAliasesWithBareSiblings()
    {
        var dataSource = _factory.Services.GetRequiredService<EndpointDataSource>();
        var routes = dataSource.Endpoints
            .OfType<RouteEndpoint>()
            .Select(e => e.RoutePattern.RawText ?? string.Empty)
            .Where(r => r.Length > 0)
            .ToList();

        var apiRoutes = routes.Where(r => r.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)).ToList();
        Assert.NotEmpty(apiRoutes); // alias ยังมีอยู่ตามที่ประกาศไว้

        // 1) ทุก /api route ต้องมี bare sibling (route เดียวกันตัด /api ออก)
        foreach (var api in apiRoutes)
        {
            var bare = api["/api".Length..];
            Assert.True(routes.Contains(bare), $"'{api}' has no bare sibling '{bare}'");
        }

        // 2) เฉพาะ 6 families ที่จดไว้ใน Program.cs เท่านั้นที่มี /api alias
        string[] documentedPrefixes =
        [
            "/api/auth", "/api/users", "/api/products", "/api/product-types", "/api/salespeople",
            "/api/hospitals", "/api/hospital-name-reviews",
            "/api/salesman-name-reviews", "/api/salesman-name-rules",
        ];
        foreach (var api in apiRoutes)
        {
            Assert.True(documentedPrefixes.Any(p => api.StartsWith(p, StringComparison.OrdinalIgnoreCase)),
                $"'{api}' is an undocumented /api alias — keep /api out of new families (see Program.cs)");
        }
    }

    [Fact]
    public async Task ApiPrefixedAuthRoute_BehavesIdenticallyToBare()
    {
        // alias ทำงานเหมือน canonical พอดี (ตัวอย่างจากคู่ login)
        using var bare = new HttpRequestMessage(HttpMethod.Post, "/auth/login")
        {
            Content = JsonContent.Create(new { email = "wrong@example.com", password = "nope1234" }),
        };
        using var aliased = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email = "wrong@example.com", password = "nope1234" }),
        };

        var bareResponse = await _client.SendAsync(bare);
        var aliasedResponse = await _client.SendAsync(aliased);
        Assert.Equal(bareResponse.StatusCode, aliasedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, aliasedResponse.StatusCode);
    }

    // ── mustChangePassword: คงบล็อก + code MUST_CHANGE_PASSWORD ครบทุกจุด (รวม GET read) ──

    private HttpRequestMessage GetAsFirstLogin(string path)
        => Get(path, UserRole.MANAGER, _factory.MustChangePasswordUserId);

    [Fact]
    public async Task MustChangePassword_GetReadEndpoint_Returns403WithCode()
    {
        var response = await _client.SendAsync(GetAsFirstLogin("/users"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("MUST_CHANGE_PASSWORD", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task MustChangePassword_AuthMe_Returns403WithCode()
    {
        var response = await _client.SendAsync(GetAsFirstLogin("/auth/me"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("MUST_CHANGE_PASSWORD", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task MustChangePassword_ChangePasswordEndpoint_IsAllowed()
    {
        var response = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/auth/change-password")
        {
            Content = JsonContent.Create(new { currentPassword = "wrong-current", newPassword = "newPassword123" }),
            Headers = { { "Authorization", new AuthenticationHeaderValue("Bearer", _factory.CreateToken(_factory.MustChangePasswordUserId, UserRole.MANAGER)).ToString() } },
        });

        // ไม่โดน gate — ไปถึง handler (400 เพราะรหัสปัจจุบันไม่ถูก) ไม่ใช่ 403 MUST_CHANGE_PASSWORD
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(json.TryGetProperty("code", out var code) && code.GetString() == "MUST_CHANGE_PASSWORD");
    }
}
