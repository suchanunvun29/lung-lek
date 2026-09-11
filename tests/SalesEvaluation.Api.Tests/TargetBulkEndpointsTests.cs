namespace SalesEvaluation.Api.Tests;

using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class TargetBulkEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TargetBulkEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task BulkDistribute_AnnualTotal_AppliesPennyAdjustmentAtMonth12()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new
        {
            scope = "SALESPERSON",
            targetScopeId = _factory.SalespersonId1,
            year = 2031,
            mode = "ANNUAL_TOTAL",
            revenueTarget = 1000000m,
            newCustomerTarget = 14,
            overwriteMode = "OVERWRITE_ALL"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkDistributeTargetsResult>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(2031, result.Year);
        Assert.Equal("SALESPERSON", result.Scope);
        Assert.Equal(_factory.SalespersonId1, result.TargetScopeId);
        Assert.Equal(12, result.CreatedCount);
        Assert.Equal(12, result.Targets.Count);

        // Verify penny adjustment for 1,000,000 / 12 = 83,333.33 * 11 + 83,333.37
        decimal totalRevenue = 0;
        for (var i = 0; i < 11; i++)
        {
            Assert.Equal("83333.33", result.Targets[i].RevenueTarget);
            Assert.Equal(1, result.Targets[i].NewCustomerTarget);
            totalRevenue += decimal.Parse(result.Targets[i].RevenueTarget, CultureInfo.InvariantCulture);
        }

        Assert.Equal("83333.37", result.Targets[11].RevenueTarget);
        Assert.Equal(3, result.Targets[11].NewCustomerTarget); // 14 - (1 * 11) = 3
        totalRevenue += decimal.Parse(result.Targets[11].RevenueTarget, CultureInfo.InvariantCulture);

        Assert.Equal(1000000m, totalRevenue);
    }

    [Fact]
    public async Task BulkDistribute_MonthlyBase_CopiesValueToAllMonths()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new
        {
            scope = "SALESPERSON",
            targetScopeId = _factory.SalespersonId2,
            year = 2032,
            mode = "MONTHLY_BASE",
            revenueTarget = 50000m,
            newCustomerTarget = 2,
            overwriteMode = "OVERWRITE_ALL"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkDistributeTargetsResult>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(12, result.Targets.Count);

        foreach (var t in result.Targets)
        {
            Assert.Equal("50000", t.RevenueTarget);
            Assert.Equal(2, t.NewCustomerTarget);
        }
    }

    [Fact]
    public async Task BulkDistribute_ThreeDimensions_IncludesProductGroups()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new
        {
            scope = "SALESPERSON",
            targetScopeId = _factory.SalespersonId1,
            year = 2033,
            mode = "ANNUAL_TOTAL",
            revenueTarget = 120000m,
            newCustomerTarget = 12,
            productGroupTargets = new[]
            {
                new { productTypeId = _factory.ProductTypeId1, revenueTarget = 60000m },
                new { productTypeId = _factory.ProductTypeId2, revenueTarget = 100m }
            },
            overwriteMode = "OVERWRITE_ALL"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkDistributeTargetsResult>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);

        // Product group 2 has 100 / 12 = 8.33 * 11 + 8.37
        Assert.Equal(2, result.Targets[0].ProductGroupTargets.Count);
        Assert.Equal("8.33", result.Targets[0].ProductGroupTargets.First(pg => pg.ProductTypeId == _factory.ProductTypeId2).RevenueTarget);
        Assert.Equal("8.37", result.Targets[11].ProductGroupTargets.First(pg => pg.ProductTypeId == _factory.ProductTypeId2).RevenueTarget);
    }

    [Fact]
    public async Task BulkDistribute_KeepCustom_PreservesExistingTarget()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);

        // First, create a single custom target for Month 5
        using var putReq = new HttpRequestMessage(HttpMethod.Put, $"/targets/{_factory.SalespersonId1}/2034/5");
        putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        putReq.Content = JsonContent.Create(new { revenueTarget = 999999m, newCustomerTarget = 99 });
        var putRes = await _client.SendAsync(putReq);
        Assert.Equal(HttpStatusCode.OK, putRes.StatusCode);

        // Now, run bulk distribute with KEEP_CUSTOM
        var payload = new
        {
            scope = "SALESPERSON",
            targetScopeId = _factory.SalespersonId1,
            year = 2034,
            mode = "MONTHLY_BASE",
            revenueTarget = 50000m,
            newCustomerTarget = 2,
            overwriteMode = "KEEP_CUSTOM"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkDistributeTargetsResult>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(11, result.CreatedCount);
        Assert.Equal(1, result.SkippedCount);

        // Verify month 5 kept custom value
        var m5 = result.Targets.First(t => t.Month == 5);
        Assert.Equal("999999", m5.RevenueTarget);
        Assert.Equal(99, m5.NewCustomerTarget);

        // Verify other month got distributed value
        var m1 = result.Targets.First(t => t.Month == 1);
        Assert.Equal("50000", m1.RevenueTarget);
    }

    [Fact]
    public async Task BulkDistribute_OverwriteAll_ReplacesExistingTarget()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);

        // Pre-create month 4 target
        using var putReq = new HttpRequestMessage(HttpMethod.Put, $"/targets/{_factory.SalespersonId2}/2035/4");
        putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        putReq.Content = JsonContent.Create(new { revenueTarget = 777777m, newCustomerTarget = 77 });
        var putRes = await _client.SendAsync(putReq);
        Assert.Equal(HttpStatusCode.OK, putRes.StatusCode);

        // Distribute with OVERWRITE_ALL
        var payload = new
        {
            scope = "SALESPERSON",
            targetScopeId = _factory.SalespersonId2,
            year = 2035,
            mode = "MONTHLY_BASE",
            revenueTarget = 40000m,
            newCustomerTarget = 4,
            overwriteMode = "OVERWRITE_ALL"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkDistributeTargetsResult>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal(11, result.CreatedCount);
        Assert.Equal(1, result.UpdatedCount);
        Assert.Equal(0, result.SkippedCount);

        var m4 = result.Targets.First(t => t.Month == 4);
        Assert.Equal("40000", m4.RevenueTarget);
        Assert.Equal(4, m4.NewCustomerTarget);
    }

    [Fact]
    public async Task BulkDistribute_TerritoryScope_Success()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new
        {
            scope = "TERRITORY",
            targetScopeId = _factory.TerritoryId1,
            year = 2036,
            mode = "MONTHLY_BASE",
            revenueTarget = 300000m,
            newCustomerTarget = 3,
            overwriteMode = "OVERWRITE_ALL"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<BulkDistributeTargetsResult>(CustomWebApplicationFactory.DefaultJsonOptions);
        Assert.NotNull(result);
        Assert.Equal("TERRITORY", result.Scope);
        Assert.Equal(_factory.TerritoryId1, result.TargetScopeId);
        Assert.Equal(12, result.Targets.Count);
        Assert.All(result.Targets, t =>
        {
            Assert.Equal("TERRITORY", t.Scope);
            Assert.Equal(_factory.TerritoryId1, t.TerritoryId);
        });
    }

    [Fact]
    public async Task BulkDistribute_ForbiddenForNonManager()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        var payload = new
        {
            scope = "SALESPERSON",
            targetScopeId = _factory.SalespersonId1,
            year = 2037,
            mode = "ANNUAL_TOTAL",
            revenueTarget = 100000m
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task BulkDistribute_InvalidInput_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        var payload = new
        {
            scope = "INVALID_SCOPE",
            targetScopeId = _factory.SalespersonId1,
            year = 2038,
            mode = "ANNUAL_TOTAL",
            revenueTarget = -100m
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "/targets/bulk-distribute");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(payload);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
