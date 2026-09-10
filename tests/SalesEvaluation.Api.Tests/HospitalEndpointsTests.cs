namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.Hospitals;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class HospitalEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public HospitalEndpointsTests(CustomWebApplicationFactory factory)
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
    public async Task GetHospitals_WithoutAuth_Returns401()
    {
        ClearAuth();
        var response = await _client.GetAsync("/hospitals");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetHospitals_WithValidToken_Returns200AndHospitals()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/hospitals");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalsResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.Hospitals);
        Assert.True(result.Hospitals.Count >= 3);

        var hosp1 = result.Hospitals.FirstOrDefault(h => h.Id == _factory.HospitalId1);
        Assert.NotNull(hosp1);
        Assert.NotNull(hosp1.Territory);
        Assert.Equal("ภาคเหนือ", hosp1.Territory.Name);
        Assert.True(hosp1.Aliases.Count >= 1);
    }

    [Fact]
    public async Task GetHospitals_GatewayRoute_ReturnsIdenticalResult()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var direct = await _client.GetStringAsync("/hospitals");
        var gateway = await _client.GetStringAsync("/api/hospitals");

        Assert.Equal(direct, gateway);
    }

    [Fact]
    public async Task PatchHospital_WithManagerToken_UpdatesPreExistingCustomer()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { isPreExistingCustomer = true };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PatchAsync($"/hospitals/{_factory.HospitalId2}", content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.True(result.Hospital.IsPreExistingCustomer);
    }

    [Fact]
    public async Task PostHospitalAlias_WithManagerToken_CreatesAlias()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { sampleRaw = "รพ.เชียงใหม่ นครพิงค์", normalizedKey = "CHIANGMAI_NAKORN" };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PostAsync($"/hospitals/{_factory.HospitalId1}/aliases", content);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<CreateHospitalAliasResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal("CHIANGMAI_NAKORN", result.HospitalAlias.NormalizedKey);
        Assert.Equal(_factory.HospitalId1, result.HospitalAlias.HospitalId);
    }

    [Fact]
    public async Task PatchHospitalTerritory_WithManagerToken_UpdatesTerritory()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId2, note = "ย้ายไปภาคกลาง" };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PatchAsync($"/hospitals/{_factory.HospitalId2}/territory", content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(_factory.TerritoryId2, result.Hospital.TerritoryId);
        Assert.Equal("MANUAL", result.Hospital.TerritorySource);
    }

    [Fact]
    public async Task BulkMoveHospitalsByProvince_WithManagerToken_UpdatesAllInProvince()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { province = "กรุงเทพมหานคร", territoryId = _factory.TerritoryId2, note = "จัดเข้าภาคกลางทั้งหมด" };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PostAsync("/hospitals/territory/bulk-by-province", content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkMoveHospitalsResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.True(result.UpdatedCount >= 1);
    }

    [Fact]
    public async Task GetUnassignedTerritoryHospitals_Returns200()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/hospitals/unassigned-territory");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<UnassignedTerritoryHospitalsResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.Hospitals);
    }

    // ------------------------------------------------- T-UX-026 bulk assign

    [Fact]
    public async Task BulkAssignTerritory_WithManagerToken_AssignsAllAndReportsSuccess()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId2, hospitalIds = new[] { _factory.HospitalId2, _factory.HospitalId3 }, note = "T-UX-026 bulk" };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkAssignTerritoryResponse>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(2, result.RequestedCount);
        Assert.Equal(2, result.AssignedCount);
        Assert.Empty(result.Failed);
        Assert.Equal(0, result.FailedCount);

        // Verify persisted state through the list endpoint.
        var hospitals = await _client.GetFromJsonAsync<HospitalsResponse>("/hospitals", CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(hospitals);
        Assert.All(hospitals.Hospitals.Where(h => h.Id == _factory.HospitalId2 || h.Id == _factory.HospitalId3), h =>
        {
            Assert.Equal(_factory.TerritoryId2, h.TerritoryId);
            Assert.Equal("MANUAL", h.TerritorySource);
        });
    }

    [Fact]
    public async Task BulkAssignTerritory_MissingHospitalInBatch_ReportsPartialFailureWithoutBlockingOthers()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId1, hospitalIds = new[] { _factory.HospitalId2, 9999 } };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkAssignTerritoryResponse>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(2, result.RequestedCount);
        Assert.Equal(1, result.AssignedCount);
        Assert.Contains(_factory.HospitalId2, result.Assigned);
        Assert.Equal(1, result.FailedCount);
        var failure = Assert.Single(result.Failed);
        Assert.Equal(9999, failure.HospitalId);
        Assert.False(string.IsNullOrWhiteSpace(failure.Error));
    }

    [Fact]
    public async Task BulkAssignTerritory_DuplicateIds_CountedOnce()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId1, hospitalIds = new[] { _factory.HospitalId2, _factory.HospitalId2 } };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);

        var result = await response.Content.ReadFromJsonAsync<BulkAssignTerritoryResponse>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(1, result.RequestedCount);
        Assert.Equal(1, result.AssignedCount);
    }

    [Fact]
    public async Task BulkAssignTerritory_EmptyHospitalIds_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId1, hospitalIds = Array.Empty<int>() };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.TryGetProperty("details", out _));
    }

    [Fact]
    public async Task BulkAssignTerritory_MissingHospitalIds_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId1 };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task BulkAssignTerritory_UnknownTerritory_Returns404()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new { territoryId = 9999, hospitalIds = new[] { _factory.HospitalId2 } };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task BulkAssignTerritory_AsSalesperson_Returns403()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var payload = new { territoryId = _factory.TerritoryId1, hospitalIds = new[] { _factory.HospitalId2 } };
        var response = await _client.PostAsJsonAsync("/hospitals/territory/bulk", payload);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
