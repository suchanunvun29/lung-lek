namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.Salespeople;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class SalespersonEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public SalespersonEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private void SetBearerToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private void ClearAuth()
    {
        _client.DefaultRequestHeaders.Authorization = null;
    }

    [Fact]
    public async Task GetSalespeople_WithoutAuth_Returns401()
    {
        ClearAuth();
        var response = await _client.GetAsync("/salespeople");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSalespeople_WithManagerToken_ReturnsAllSalespeople()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/salespeople");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<SalespeopleResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.Salespeople);
        Assert.True(result.Salespeople.Count >= 3);

        // Check user link in result
        var linkedSp = result.Salespeople.FirstOrDefault(s => s.Id == _factory.SalespersonId1);
        Assert.NotNull(linkedSp);
        Assert.NotNull(linkedSp.User);
        Assert.Equal(_factory.SalespersonUserId, linkedSp.User.Id);
    }

    [Fact]
    public async Task GetSalespeople_GatewayRoute_ReturnsIdenticalResult()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var direct = await _client.GetStringAsync("/salespeople");
        var gateway = await _client.GetStringAsync("/api/salespeople");

        Assert.Equal(direct, gateway);
    }

    [Fact]
    public async Task GetSalespeople_WithSalespersonToken_ReturnsScopedList()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var response = await _client.GetAsync("/salespeople");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<SalespeopleResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.Salespeople);
        // SP1 is supervisor of Terr1 (which has SP1 and SP2), so SP1 sees SP1 and SP2, but not SP3
        Assert.Contains(result.Salespeople, s => s.Id == _factory.SalespersonId1);
        Assert.Contains(result.Salespeople, s => s.Id == _factory.SalespersonId2);
        Assert.DoesNotContain(result.Salespeople, s => s.Id == _factory.SalespersonId3);
    }

    [Fact]
    public async Task PatchSalesperson_WithSalespersonToken_Returns403Forbidden()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var content = new StringContent(JsonSerializer.Serialize(new { displayName = "New Name" }), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/salespeople/{_factory.SalespersonId1}", content);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PatchSalesperson_WithNonExistentId_Returns404NotFound()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var content = new StringContent(JsonSerializer.Serialize(new { displayName = "New Name" }), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync("/salespeople/non-existent-sp-999", content);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PatchSalesperson_WithInvalidDateFormat_Returns400ValidationError()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var content = new StringContent(JsonSerializer.Serialize(new { employmentEndedAt = "2026/12/31" }), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/salespeople/{_factory.SalespersonId2}", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PatchSalesperson_LinkingAlreadyLinkedUser_Returns409Conflict()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        // SalespersonUserId is already linked to SalespersonId1. Trying to link it to SalespersonId2
        var content = new StringContent(JsonSerializer.Serialize(new { userId = _factory.SalespersonUserId }), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/salespeople/{_factory.SalespersonId2}", content);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("This user is already linked to another salesperson", err.GetString());
    }

    [Fact]
    public async Task PatchSalesperson_WithManagerToken_UpdatesFieldsSuccessfully()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var updatePayload = new
        {
            displayName = "สมศรี ปรับปรุงใหม่",
            isActive = true,
            excludedFromTerritoryTotals = true,
            employmentEndedAt = "2026-12-31"
        };

        var content = new StringContent(JsonSerializer.Serialize(updatePayload), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/salespeople/{_factory.SalespersonId2}", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<SalespersonResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(_factory.SalespersonId2, result.Salesperson.Id);
        Assert.Equal("สมศรี ปรับปรุงใหม่", result.Salesperson.DisplayName);
        Assert.True(result.Salesperson.ExcludedFromTerritoryTotals);
        Assert.Equal("2026-12-31", result.Salesperson.EmploymentEndedAt);
    }
}
