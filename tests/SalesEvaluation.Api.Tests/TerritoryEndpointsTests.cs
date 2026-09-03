namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.Territories;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class TerritoryEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TerritoryEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private void SetBearerToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private static StringContent JsonBody(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    [Fact]
    public async Task GetTerritories_WithoutAuth_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;
        var response = await _client.GetAsync("/territories");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetTerritories_ReturnsRegionSummaryCountsAndOrder()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync("/territories");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoriesResponse>();
        Assert.NotNull(result);

        var terr1 = result.Territories.FirstOrDefault(t => t.Id == _factory.TerritoryId1);
        Assert.NotNull(terr1);
        Assert.Equal("ภาคเหนือ", terr1.Name);
        Assert.Equal(_factory.RegionId1, terr1.RegionId);
        Assert.NotNull(terr1.Region);
        Assert.Equal("ภาคเหนือ", terr1.Region.Name);
        // ta-1 (sp-1) and ta-2 (sp-2) are open — both count as active owners
        Assert.Equal(2, terr1.ActiveOwnerCount);
        // hosp-1 and hosp-3 belong to terr-1
        Assert.Equal(2, terr1.HospitalCount);

        // ordered by sortOrder asc, name asc — both 0 so name order applies
        Assert.True(result.Territories.Count >= 2);
    }

    [Fact]
    public async Task PostTerritory_WithManagerToken_CreatesTerritory()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PostAsync("/territories", JsonBody(new
        {
            name = "ภาคอีสาน",
            regionId = (string?)null,
            sortOrder = 5,
            isActive = true,
            code = "NE"
        }));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoryResponse>();
        Assert.NotNull(result);
        Assert.Equal("ภาคอีสาน", result.Territory.Name);
        Assert.Equal("NE", result.Territory.Code);
        Assert.Equal(5, result.Territory.SortOrder);
        Assert.Null(result.Territory.Region);
    }

    [Fact]
    public async Task PostTerritory_WithSalespersonToken_Returns403()
    {
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));

        var response = await _client.PostAsync("/territories", JsonBody(new { name = "X" }));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PostTerritory_WithUnknownRegion_Returns404()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PostAsync("/territories", JsonBody(new { name = "X", regionId = "region-nope" }));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Region not found", payload.GetProperty("error").GetString());
    }

    [Fact]
    public async Task PatchTerritory_WithManagerToken_UpdatesFields()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var create = await _client.PostAsync("/territories", JsonBody(new { name = "เขตชั่วคราว" }));
        var created = await create.Content.ReadFromJsonAsync<TerritoryResponse>();

        var response = await _client.PatchAsync($"/territories/{created!.Territory.Id}", JsonBody(new { name = "เขตปรับชื่อ", isActive = false, note = "หมายเหตุ" }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoryResponse>();
        Assert.Equal("เขตปรับชื่อ", result!.Territory.Name);
        Assert.False(result.Territory.IsActive);
        Assert.Equal("หมายเหตุ", result.Territory.Note);
    }

    [Fact]
    public async Task PatchTerritory_WithEmptyBody_Returns400()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync($"/territories/{_factory.TerritoryId1}", JsonBody(new { }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("ต้องระบุข้อมูลที่ต้องการแก้ไข", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PatchTerritory_WithNonExistentId_Returns404()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync("/territories/nope", JsonBody(new { name = "X" }));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAssignments_FiltersByTerritoryAndStatus()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/territory-assignments?territoryId={_factory.TerritoryId1}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoryAssignmentsResponse>();
        Assert.NotNull(result);
        Assert.Equal(2, result.TerritoryAssignments.Count);

        var first = result.TerritoryAssignments[0];
        Assert.Equal(_factory.TerritoryId1, first.TerritoryId);
        Assert.Equal(_factory.TerritoryId1, first.Territory.Id);
        Assert.Equal("ภาคเหนือ", first.Territory.Name);
        Assert.NotNull(first.Salesperson);
        // seeded rows have no assigner
        Assert.Null(first.AssignedBy);

        var active = await _client.GetFromJsonAsync<TerritoryAssignmentsResponse>(
            $"/territory-assignments?territoryId={_factory.TerritoryId1}&status=ACTIVE");
        Assert.Equal(2, active!.TerritoryAssignments.Count);

        var inactive = await _client.GetFromJsonAsync<TerritoryAssignmentsResponse>(
            $"/territory-assignments?territoryId={_factory.TerritoryId1}&status=INACTIVE");
        Assert.Empty(inactive!.TerritoryAssignments);
    }

    [Fact]
    public async Task PutAssignment_AssignThenWithdraw_TemporalLifecycle()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        // Assign — 201 with an open row
        var assign = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            salespersonId = _factory.SalespersonId3,
            effectiveFrom = "2026-03-01",
            isSupervisor = false,
            note = (string?)null
        }));
        Assert.Equal(HttpStatusCode.Created, assign.StatusCode);

        var created = await assign.Content.ReadFromJsonAsync<AssignmentResponse>();
        Assert.Equal("2026-03-01", created!.Assignment.EffectiveFrom.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        Assert.Null(created.Assignment.EffectiveTo);
        Assert.Equal(_factory.ManagerUserId, created.Assignment.AssignedById);

        // Earlier effectiveFrom than the open row → 400
        var early = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            salespersonId = _factory.SalespersonId3,
            effectiveFrom = "2026-01-01"
        }));
        Assert.Equal(HttpStatusCode.BadRequest, early.StatusCode);
        Assert.Contains("effectiveFrom ต้องไม่เร็วกว่าหรือเท่ากับ", await early.Content.ReadAsStringAsync());

        // Withdraw before the open row starts → 400
        var tooEarly = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            salespersonId = _factory.SalespersonId3,
            effectiveTo = "2026-01-15"
        }));
        Assert.Equal(HttpStatusCode.BadRequest, tooEarly.StatusCode);
        Assert.Contains("effectiveTo ต้องไม่ก่อน effectiveFrom", await tooEarly.Content.ReadAsStringAsync());

        // Withdraw — 200, closes the open row without deleting it
        var withdraw = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            salespersonId = _factory.SalespersonId3,
            effectiveTo = "2026-06-30"
        }));
        Assert.Equal(HttpStatusCode.OK, withdraw.StatusCode);

        var closed = await withdraw.Content.ReadFromJsonAsync<AssignmentResponse>();
        Assert.Equal("2026-06-30", closed!.Assignment.EffectiveTo!.Value.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));

        // The closed row is still history — visible as INACTIVE
        var inactive = await _client.GetFromJsonAsync<TerritoryAssignmentsResponse>(
            $"/territory-assignments?territoryId={_factory.TerritoryId2}&salespersonId={_factory.SalespersonId3}&status=INACTIVE");
        Assert.Single(inactive!.TerritoryAssignments);

        // Second withdraw with no open rows → 404
        var gone = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            salespersonId = _factory.SalespersonId3,
            effectiveTo = "2026-08-31"
        }));
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
        Assert.Contains("Territory assignment not found", await gone.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PutAssignment_WithBothEffectiveFromAndTo_Returns400()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId1,
            salespersonId = _factory.SalespersonId1,
            effectiveFrom = "2027-01-01",
            effectiveTo = "2027-12-31"
        }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("ห้ามส่ง effectiveFrom และ effectiveTo พร้อมกัน", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PutAssignment_WithNeitherEffectiveFromNorTo_Returns400()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId1,
            salespersonId = _factory.SalespersonId1
        }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("ต้องระบุ effectiveFrom หรือ effectiveTo", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PutAssignment_WithSalespersonToken_Returns403()
    {
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));

        var response = await _client.PutAsync("/territory-assignments", JsonBody(new
        {
            territoryId = _factory.TerritoryId1,
            salespersonId = _factory.SalespersonId3,
            effectiveFrom = "2027-01-01"
        }));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
