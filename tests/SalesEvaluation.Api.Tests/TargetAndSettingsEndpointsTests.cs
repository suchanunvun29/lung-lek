namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class TargetAndSettingsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TargetAndSettingsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetTargets_ReturnsTargetsPayload()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/targets?periodType=YEAR&year=2026");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("targets", out _));
    }

    [Fact]
    public async Task GetTargetSuggestions_ReturnsSuggestionsPayload()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/target-suggestions/2026/1?territoryId={_factory.TerritoryId1}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("units", out _) || json.TryGetProperty("regions", out _) || json.TryGetProperty("settings", out _));
    }

    [Fact]
    public async Task GetScoringWeights_ReturnsWeightsPayload()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/settings/scoring-weights");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("weights", out _));
    }

    [Fact]
    public async Task GetEvaluationSettings_ReturnsSettingsPayload()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/settings/evaluation");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("churnMonths", out _) || json.TryGetProperty("setting", out _));
    }

    [Fact]
    public async Task GetTierWeights_ReturnsWeightsPayload()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/settings/tier-weights");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Object, json.ValueKind);
    }

    // ---- WACC-P0-003: PUT /targets/territory/{territoryId}/{year}/{month} & PUT /targets/group/{territoryGroupId}/{year}/{month} ----

    [Fact]
    public async Task UpsertTerritoryTarget_Success_Returns200()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new { revenueTarget = 500000m, newCustomerTarget = 2 };
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/targets/territory/{_factory.TerritoryId1}/2026/1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("target", out var target));
        Assert.Equal("500000", target.GetProperty("revenueTarget").GetString());
        Assert.Equal(_factory.TerritoryId1, target.GetProperty("territoryId").GetInt32());
    }

    [Fact]
    public async Task UpsertTerritoryTarget_SalespersonForbidden_Returns403()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        var payload = new { revenueTarget = 500000m, newCustomerTarget = 2 };
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/targets/territory/{_factory.TerritoryId1}/2026/1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpsertTerritoryTarget_NegativeAmount_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new { revenueTarget = -10m, newCustomerTarget = 2 };
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/targets/territory/{_factory.TerritoryId1}/2026/1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpsertTerritoryGroupTarget_Success_Returns200()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new { revenueTarget = 1500000m, newCustomerTarget = 5 };
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/targets/group/{_factory.TerritoryGroupId1}/2026/1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("target", out var target));
        Assert.Equal("1500000", target.GetProperty("revenueTarget").GetString());
        Assert.Equal(_factory.TerritoryGroupId1, target.GetProperty("territoryGroupId").GetInt32());
    }
}
