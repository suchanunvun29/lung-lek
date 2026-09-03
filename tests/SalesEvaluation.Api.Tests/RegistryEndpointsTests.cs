namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.HospitalRegistry;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class RegistryEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public RegistryEndpointsTests(CustomWebApplicationFactory factory)
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

    // ---- Provinces ----

    [Fact]
    public async Task GetProvinces_ReturnsProvincesWithRegions()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync("/provinces");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<ProvincesResponse>();
        Assert.NotNull(result);
        Assert.Equal(2, result.Provinces.Count);

        // assert by id — another test in this class may have renamed pm-2
        var pm1 = result.Provinces.Single(p => p.Id == _factory.ProvinceMappingId1);
        Assert.Equal("เชียงใหม่", pm1.CanonicalName);
        Assert.NotNull(pm1.Region);
        Assert.Equal(_factory.RegionId1, pm1.RegionId);
        var pm2 = result.Provinces.Single(p => p.Id == _factory.ProvinceMappingId2);
        Assert.NotNull(pm2.Region);

        Assert.Equal(2, result.Regions.Count);
        Assert.Equal("ภาคเหนือ", result.Regions[0].Name);
        Assert.Equal("ภาคกลาง", result.Regions[1].Name);
    }

    [Fact]
    public async Task PatchProvince_UpdatesCanonicalNameAndRegion()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync($"/provinces/{_factory.ProvinceMappingId2}", JsonBody(new
        {
            canonicalName = "ชลบุรี",
            regionId = _factory.RegionId1
        }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<ProvinceResponse>();
        Assert.Equal("ชลบุรี", result!.Province.CanonicalName);
        Assert.Equal(_factory.RegionId1, result.Province.RegionId);
        Assert.Equal("ภาคเหนือ", result.Province.Region.Name);
    }

    [Fact]
    public async Task PatchProvince_ValidationErrors()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var empty = await _client.PatchAsync($"/provinces/{_factory.ProvinceMappingId2}", JsonBody(new { }));
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Contains("Provide canonicalName or regionId", await empty.Content.ReadAsStringAsync());

        var missingRegion = await _client.PatchAsync($"/provinces/{_factory.ProvinceMappingId2}", JsonBody(new { regionId = 99999 }));
        Assert.Equal(HttpStatusCode.NotFound, missingRegion.StatusCode);
        Assert.Contains("Region not found", await missingRegion.Content.ReadAsStringAsync());

        var missingProvince = await _client.PatchAsync("/provinces/99999", JsonBody(new { canonicalName = "X" }));
        Assert.Equal(HttpStatusCode.NotFound, missingProvince.StatusCode);
        Assert.Contains("Province not found", await missingProvince.Content.ReadAsStringAsync());
    }

    // ---- Hospital registries ----

    [Fact]
    public async Task GetHospitalRegistries_ReturnsPagedResultWithFilters()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync("/hospital-registries");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalRegistriesResponse>();
        Assert.NotNull(result);
        Assert.Equal(4, result.Total);
        Assert.Equal(1, result.Page);
        Assert.Equal(50, result.PageSize);
        Assert.Equal(4, result.HospitalRegistries.Count);

        var withMetrics = result.HospitalRegistries.Single(r => r.Id == _factory.HospitalRegistryId1);
        Assert.Equal("10717", withMetrics.SourceCode);
        Assert.Equal("A", withMetrics.Tier);
        Assert.Equal("GOVERNMENT_GENERAL", withMetrics.Category);
        Assert.Equal("1.000", withMetrics.PotentialAdjustment);
        Assert.Equal(_factory.TerritoryId1, withMetrics.TerritoryId);
        Assert.NotNull(withMetrics.Territory);
        Assert.Equal("ภาคเหนือ", withMetrics.Territory.Name);
        Assert.NotNull(withMetrics.ProvinceMapping);
        Assert.Equal("ภาคเหนือ", withMetrics.ProvinceMapping.Region.Name);
        Assert.Equal(2, withMetrics.Metrics.Count);

        // q filter
        var search = await _client.GetFromJsonAsync<HospitalRegistriesResponse>("/hospital-registries?q=ลำพูน");
        Assert.Equal(1, search!.Total);
        Assert.Equal(_factory.HospitalRegistryId2, search.HospitalRegistries.Single().Id);

        // provinceMappingId filter
        var byProvince = await _client.GetFromJsonAsync<HospitalRegistriesResponse>($"/hospital-registries?provinceMappingId={_factory.ProvinceMappingId1}");
        Assert.Equal(2, byProvince!.Total);

        // territoryId filter
        var byTerritory = await _client.GetFromJsonAsync<HospitalRegistriesResponse>($"/hospital-registries?territoryId={_factory.TerritoryId1}");
        Assert.Equal(4, byTerritory!.Total);

        // pagination
        var paged = await _client.GetFromJsonAsync<HospitalRegistriesResponse>("/hospital-registries?page=2&pageSize=2");
        Assert.Equal(4, paged!.Total);
        Assert.Equal(2, paged.HospitalRegistries.Count);
    }

    [Fact]
    public async Task GetHospitalRegistries_WithSalespersonToken_Returns403()
    {
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));

        var response = await _client.GetAsync("/hospital-registries");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PatchPotentialAdjustment_UpdatesAndReturnsTrimmedShape()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync($"/hospital-registry/{_factory.HospitalRegistryId2}/potential-adjustment", JsonBody(new { potentialAdjustment = 0.5 }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var raw = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"potentialAdjustment\":\"0.5\"", raw);

        var result = await response.Content.ReadFromJsonAsync<PotentialAdjustmentResponse>();
        Assert.Equal(_factory.HospitalRegistryId2, result!.HospitalRegistry.Id);
        Assert.Equal("โรงพยาบาลลำพูน", result.HospitalRegistry.DisplayName);
        Assert.Equal("B", result.HospitalRegistry.Tier);
    }

    [Fact]
    public async Task PatchPotentialAdjustment_Errors()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var missing = await _client.PatchAsync("/hospital-registry/99999/potential-adjustment", JsonBody(new { potentialAdjustment = 1 }));
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Contains("Hospital registry not found", await missing.Content.ReadAsStringAsync());

        var outOfRange = await _client.PatchAsync($"/hospital-registry/{_factory.HospitalRegistryId2}/potential-adjustment", JsonBody(new { potentialAdjustment = 1000 }));
        Assert.Equal(HttpStatusCode.BadRequest, outOfRange.StatusCode);

        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));
        var forbidden = await _client.PatchAsync($"/hospital-registry/{_factory.HospitalRegistryId2}/potential-adjustment", JsonBody(new { potentialAdjustment = 1 }));
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    // ---- Registry links ----

    [Fact]
    public async Task GetRegistryLinks_ReturnsLinksWithIncludes()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync("/hospital-registry-links");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalRegistryLinksResponse>();
        Assert.NotNull(result);

        var link = result.HospitalRegistryLinks.Single(l => l.Id == _factory.RegistryLinkId1);
        Assert.Equal(RegistryLinkStatus.LINKED.ToString(), link.Status);
        Assert.Equal("1.0000", link.Confidence);
        Assert.Equal("EXACT", link.Method);
        Assert.Equal(_factory.HospitalId1, link.Hospital.Id);
        Assert.Equal("รพ.เชียงใหม่", link.Hospital.DisplayName);
        Assert.NotNull(link.Hospital.ProvinceMapping);
        Assert.Equal("เชียงใหม่", link.Hospital.ProvinceMapping.CanonicalName);
        Assert.NotNull(link.HospitalRegistry);
        Assert.Equal("โรงพยาบาลเชียงใหม่", link.HospitalRegistry.DisplayName);
        Assert.NotNull(link.HospitalRegistry.ProvinceMapping);
        Assert.NotNull(link.HospitalRegistry.Territory);

        // status filter
        var absent = await _client.GetFromJsonAsync<HospitalRegistryLinksResponse>("/hospital-registry-links?status=UNREVIEWED");
        Assert.Empty(absent!.HospitalRegistryLinks);

        // invalid status → 400
        var invalid = await _client.GetAsync("/hospital-registry-links?status=BOGUS");
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        // salesperson → 403
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));
        var forbidden = await _client.GetAsync("/hospital-registry-links");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task PatchRegistryLink_UpsertsManualLink()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        // hosp-2 has no link yet — upsert creates it
        var create = await _client.PatchAsync($"/hospital-registry-links/{_factory.HospitalId2}", JsonBody(new
        {
            status = "LINKED",
            hospitalRegistryId = _factory.HospitalRegistryId2
        }));
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);

        var created = await create.Content.ReadFromJsonAsync<HospitalRegistryLinkResponse>();
        Assert.Equal(_factory.HospitalId2, created!.HospitalRegistryLink.HospitalId);
        Assert.Equal(_factory.HospitalRegistryId2, created.HospitalRegistryLink.HospitalRegistryId);
        Assert.Equal("LINKED", created.HospitalRegistryLink.Status);
        Assert.Equal("MANUAL", created.HospitalRegistryLink.Method);
        Assert.Equal("1", created.HospitalRegistryLink.Confidence);
        Assert.Equal(_factory.ManagerUserId, created.HospitalRegistryLink.ReviewedById);
        Assert.NotNull(created.HospitalRegistryLink.ReviewedBy);
        Assert.Equal("Manager User", created.HospitalRegistryLink.ReviewedBy.DisplayName);
        Assert.Null(created.HospitalRegistryLink.Hospital.ProvinceMapping);
    }

    [Fact]
    public async Task PatchRegistryLink_ValidationErrors()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var linkedWithoutRegistry = await _client.PatchAsync($"/hospital-registry-links/{_factory.HospitalId2}", JsonBody(new { status = "LINKED" }));
        Assert.Equal(HttpStatusCode.BadRequest, linkedWithoutRegistry.StatusCode);
        Assert.Contains("Required when status is LINKED", await linkedWithoutRegistry.Content.ReadAsStringAsync());

        var absentWithRegistry = await _client.PatchAsync($"/hospital-registry-links/{_factory.HospitalId2}", JsonBody(new
        {
            status = "CONFIRMED_ABSENT",
            hospitalRegistryId = _factory.HospitalRegistryId1
        }));
        Assert.Equal(HttpStatusCode.BadRequest, absentWithRegistry.StatusCode);
        Assert.Contains("Must be null when confirming absence", await absentWithRegistry.Content.ReadAsStringAsync());

        var missingHospital = await _client.PatchAsync("/hospital-registry-links/99999", JsonBody(new { status = "LINKED", hospitalRegistryId = _factory.HospitalRegistryId1 }));
        Assert.Equal(HttpStatusCode.NotFound, missingHospital.StatusCode);
        Assert.Contains("Hospital not found", await missingHospital.Content.ReadAsStringAsync());

        var missingRegistry = await _client.PatchAsync($"/hospital-registry-links/{_factory.HospitalId2}", JsonBody(new { status = "LINKED", hospitalRegistryId = 99999 }));
        Assert.Equal(HttpStatusCode.NotFound, missingRegistry.StatusCode);
        Assert.Contains("Hospital registry not found", await missingRegistry.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PatchRegistryLink_ConfirmedAbsent_ClearsLink()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync($"/hospital-registry-links/{_factory.HospitalId3}", JsonBody(new
        {
            status = "CONFIRMED_ABSENT",
            hospitalRegistryId = (int?)null
        }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalRegistryLinkResponse>();
        Assert.Equal("CONFIRMED_ABSENT", result!.HospitalRegistryLink.Status);
        Assert.Null(result.HospitalRegistryLink.HospitalRegistryId);
        Assert.Null(result.HospitalRegistryLink.Confidence);
    }
}
