namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.ReviewQueues;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class ReviewQueueEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ReviewQueueEndpointsTests(CustomWebApplicationFactory factory)
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
    public async Task GetHospitalNameReviews_WithManagerToken_Returns200AndReviews()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/hospital-name-reviews");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalNameReviewsResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.HospitalNameReviews);
    }

    [Fact]
    public async Task GetHospitalNameReviews_WithSalespersonToken_Returns403Forbidden()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var response = await _client.GetAsync("/hospital-name-reviews");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DecideHospitalNameReview_KeptSeparate_Returns200()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new
        {
            decision = "KEPT_SEPARATE",
            note = "ยืนยันเป็นคนละแห่งกัน"
        };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PatchAsync($"/hospital-name-reviews/{_factory.HospitalReviewId1}", content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<HospitalNameReviewResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal("KEPT_SEPARATE", result.HospitalNameReview.Status);
    }

    [Fact]
    public async Task GetSalesmanNameReviews_WithManagerToken_Returns200()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/salesman-name-reviews");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<SalesmanNameReviewsResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.SalesmanNameReviews);
    }

    [Fact]
    public async Task DecideSalesmanNameReview_Merged_Returns200()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new
        {
            decision = "MERGED",
            mergedIntoId = _factory.SalespersonId1,
            note = "รวมเข้าสมชายตัวหลัก"
        };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PatchAsync($"/salesman-name-reviews/{_factory.SalesmanReviewId1}", content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<SalesmanNameReviewResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal("MERGED", result.SalesmanNameReview.Status);
        Assert.Equal(_factory.SalespersonId1, result.SalesmanNameReview.MergedIntoId);
    }

    [Fact]
    public async Task GetSalesmanNameRules_WithManagerToken_Returns200AndRules()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/salesman-name-rules");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<SalesmanNameRulesResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.SalesmanNameRules);
        Assert.True(result.SalesmanNameRules.Count >= 1);
    }

    [Fact]
    public async Task UpdateSalesmanNameRule_WithValidShares_UpdatesSuccessfully()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new
        {
            members = new[]
            {
                new { salespersonId = _factory.SalespersonId1, sharePercent = 50m },
                new { salespersonId = _factory.SalespersonId2, sharePercent = 50m }
            }
        };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PatchAsync($"/salesman-name-rules/{_factory.SalesmanRuleId1}", content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<SalesmanNameRuleResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(2, result.SalesmanNameRule.Members.Count);
        Assert.Equal(50m, result.SalesmanNameRule.Members.First(m => m.SalespersonId == _factory.SalespersonId1).SharePercent);
    }

    [Fact]
    public async Task UpdateSalesmanNameRule_WithInvalidSumShares_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var payload = new
        {
            members = new[]
            {
                new { salespersonId = _factory.SalespersonId1, sharePercent = 70m },
                new { salespersonId = _factory.SalespersonId2, sharePercent = 20m } // Sum = 90%
            }
        };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await _client.PatchAsync($"/salesman-name-rules/{_factory.SalesmanRuleId1}", content);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Validation failed", err.GetString());
    }
}
