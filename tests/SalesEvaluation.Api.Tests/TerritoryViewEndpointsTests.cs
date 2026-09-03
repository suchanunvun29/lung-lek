namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Contracts.TerritoryViews;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class TerritoryViewEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TerritoryViewEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private void SetBearerToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private const string MonthQuery = "periodType=MONTH&year=2026&periodNumber=1";

    [Fact]
    public async Task GetMyTerritoryView_ReturnsSoldAndSoldBeforeBuckets()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?{MonthQuery}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<MyTerritoryViewResponse>();
        Assert.NotNull(result);

        Assert.Equal(_factory.SalespersonId1, result.Salesperson.Id);
        Assert.Equal("สมชาย", result.Salesperson.DisplayName);
        var territory = Assert.Single(result.Territories);
        Assert.Equal(_factory.TerritoryId1, territory.Id);
        Assert.Equal("ภาคเหนือ", territory.DisplayName);

        Assert.Equal("TERRITORY_TOTAL", result.Mode);
        Assert.False(result.CreditOnly);
        Assert.Null(result.ProductTypeId);

        // hosp-1 credited (100% to sp-1) in 2026-01 with total 1070
        var sold = Assert.Single(result.SoldHospitals);
        Assert.Equal(_factory.HospitalId1, sold.Hospital.Id);
        Assert.Equal(1070m, sold.Revenue);

        // hosp-3 sold in 2025-06 only — in the same territory, so it surfaces as sold-before
        var before = Assert.Single(result.SoldBeforeButNotInPeriod);
        Assert.Equal(_factory.HospitalId3, before.Hospital.Id);
        Assert.Equal("รพ.ศิริราช 2", before.Hospital.DisplayName);
        Assert.Equal("กรุงเทพมหานคร", before.Hospital.Province);

        // the raw query is echoed back verbatim (string values)
        var raw = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(raw);
        var period = doc.RootElement.GetProperty("period");
        Assert.Equal("MONTH", period.GetProperty("periodType").GetString());
        Assert.Equal("2026", period.GetProperty("year").GetString());
        Assert.Equal("1", period.GetProperty("periodNumber").GetString());
    }

    [Fact]
    public async Task GetMyTerritoryView_WithCreditOnly_SetsOwnCreditMode()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?{MonthQuery}&creditOnly=true");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<MyTerritoryViewResponse>();
        Assert.Equal("OWN_CREDIT_ONLY", result!.Mode);
        Assert.True(result.CreditOnly);
    }

    [Fact]
    public async Task GetMyTerritoryView_WithoutAssignments_FallsBackToNationwide()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId3}?{MonthQuery}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<MyTerritoryViewResponse>();
        Assert.Equal("NATIONWIDE_PRODUCT_TYPE_FALLBACK", result!.Mode);
        Assert.Empty(result.Territories);
        Assert.Empty(result.SoldHospitals);
    }

    [Fact]
    public async Task GetMyTerritoryView_WithQuarterPeriod_Works()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?periodType=QUARTER&year=2026&periodNumber=1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<MyTerritoryViewResponse>();
        var sold = Assert.Single(result!.SoldHospitals);
        Assert.Equal(1070m, sold.Revenue);
    }

    [Fact]
    public async Task GetMyTerritoryView_ScopeAndNotFound()
    {
        // sp-1 (salesperson user) cannot see sp-3 — 403
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));
        var forbidden = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId3}?{MonthQuery}");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Contains("Forbidden", await forbidden.Content.ReadAsStringAsync());

        // manager sees everyone, but the salesperson must exist — 404
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));
        var missing = await _client.GetAsync($"/my-territory-view/sp-nope?{MonthQuery}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Contains("Salesperson not found", await missing.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GetMyTerritoryView_WithInvalidPeriod_Returns400()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var badPeriodNumber = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?periodType=MONTH&year=2026&periodNumber=13");
        Assert.Equal(HttpStatusCode.BadRequest, badPeriodNumber.StatusCode);

        var badQuarter = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?periodType=QUARTER&year=2026&periodNumber=5");
        Assert.Equal(HttpStatusCode.BadRequest, badQuarter.StatusCode);

        var missingPeriodNumber = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?periodType=MONTH&year=2026");
        Assert.Equal(HttpStatusCode.BadRequest, missingPeriodNumber.StatusCode);

        var badType = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}?periodType=WEEK&year=2026&periodNumber=1");
        Assert.Equal(HttpStatusCode.BadRequest, badType.StatusCode);
    }

    [Fact]
    public async Task GetNeverSoldHospitals_ReturnsGovernmentGeneralNeverSoldOnly()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}/never-sold?{MonthQuery}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<NeverSoldHospitalsResponse>();
        Assert.NotNull(result);

        Assert.Equal("TERRITORY_TOTAL", result.Mode);
        Assert.Equal("BEDS", result.PotentialMetric);
        Assert.Equal(20, result.TopN);

        // Only hreg-2: GOVERNMENT_GENERAL + active + in terr-1 + never sold.
        // hreg-1 is linked to sold hosp-1, hreg-3 is PRIVATE, hreg-4 is inactive.
        Assert.Equal(1, result.TotalNeverSold);
        var item = Assert.Single(result.NeverSoldHospitals);
        Assert.Equal(_factory.HospitalRegistryId2, item.Id);
        Assert.Equal("โรงพยาบาลลำพูน", item.DisplayName);
        Assert.Equal("เชียงใหม่", item.Province);
        Assert.Equal("B", item.Tier);
        Assert.Equal(0m, item.MetricValue);
        Assert.NotNull(item.Territory);
        Assert.Equal("ภาคเหนือ", item.Territory.DisplayName);

        // With a productType nobody sold, no registry is excluded by sales history:
        // hreg-1 (BEDS 100.5) re-enters and outranks hreg-2 (no metrics → 0).
        var filtered = await _client.GetFromJsonAsync<NeverSoldHospitalsResponse>(
            $"/my-territory-view/{_factory.SalespersonId1}/never-sold?{MonthQuery}&productTypeId={_factory.ProductTypeId2}");
        Assert.Equal(2, filtered!.TotalNeverSold);
        Assert.Equal(_factory.HospitalRegistryId1, filtered.NeverSoldHospitals[0].Id);
        Assert.Equal(100.5m, filtered.NeverSoldHospitals[0].MetricValue);
    }

    [Fact]
    public async Task GetNeverSoldHospitals_ScopeAndValidation()
    {
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));
        var forbidden = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId3}/never-sold?{MonthQuery}");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));
        var missing = await _client.GetAsync($"/my-territory-view/sp-nope/never-sold?{MonthQuery}");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);

        var badMetric = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}/never-sold?{MonthQuery}&potentialMetric=NOPE");
        Assert.Equal(HttpStatusCode.BadRequest, badMetric.StatusCode);

        var badTopN = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}/never-sold?{MonthQuery}&topN=0");
        Assert.Equal(HttpStatusCode.BadRequest, badTopN.StatusCode);
    }

    [Fact]
    public async Task ExportMyTerritoryView_ReturnsXlsx()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}/export?{MonthQuery}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("my-territory-view.xlsx", response.Content.Headers.ContentDisposition!.FileName);
        Assert.True((await response.Content.ReadAsByteArrayAsync()).Length > 0);
    }

    [Fact]
    public async Task ExportNeverSoldHospitals_ReturnsXlsx()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId1}/never-sold/export?{MonthQuery}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("never-sold-hospitals.xlsx", response.Content.Headers.ContentDisposition!.FileName);
        Assert.True((await response.Content.ReadAsByteArrayAsync()).Length > 0);
    }

    [Fact]
    public async Task ExportMyTerritoryView_ScopeEnforced()
    {
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));

        var response = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId3}/export?{MonthQuery}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var neverSold = await _client.GetAsync($"/my-territory-view/{_factory.SalespersonId3}/never-sold/export?{MonthQuery}");
        Assert.Equal(HttpStatusCode.Forbidden, neverSold.StatusCode);
    }
}
