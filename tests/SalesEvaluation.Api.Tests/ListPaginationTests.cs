namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Contracts.Hospitals;
using SalesEvaluation.Contracts.Targets;
using SalesEvaluation.Contracts.Users;
using SalesEvaluation.Domain.Enums;
using Xunit;

/// <summary>
/// T-UX-025 — one pagination contract across /users, /hospitals, /import-batches
/// and /targets/{id}/revisions: optional page/pageSize; when either is present the
/// response is {items, total, page, pageSize} with total counted AFTER filters;
/// when neither is sent the legacy full-list shape is returned unchanged
/// (declared default — dropdown consumers rely on it).
/// </summary>
public class ListPaginationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ListPaginationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private void SetBearerToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private string ManagerToken => _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);

    private async Task<JsonDocument> GetJsonAsync(string url)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ManagerToken);
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    // ------------------------------------------------------------------ users

    [Fact]
    public async Task GetUsers_WithoutPageParams_ReturnsLegacyFullListShape()
    {
        SetBearerToken(ManagerToken);
        using var doc = await GetJsonAsync("/users");

        Assert.True(doc.RootElement.TryGetProperty("users", out var users), "legacy shape must expose `users`");
        Assert.Equal(JsonValueKind.Array, users.ValueKind);
        Assert.True(users.GetArrayLength() >= 5);
        Assert.False(doc.RootElement.TryGetProperty("items", out _), "legacy shape must not expose `items`");
    }

    [Fact]
    public async Task GetUsers_WithPageParams_ReturnsPagedContractShape()
    {
        SetBearerToken(ManagerToken);
        using var doc = await GetJsonAsync("/users?page=1&pageSize=2");

        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("items", out var items));
        Assert.Equal(2, items.GetArrayLength());
        Assert.True(root.TryGetProperty("total", out var total));
        Assert.True(total.GetInt32() >= 5, "total must cover the whole filtered set");
        Assert.Equal(1, root.GetProperty("page").GetInt32());
        Assert.Equal(2, root.GetProperty("pageSize").GetInt32());
        Assert.False(root.TryGetProperty("users", out _), "paged shape must not expose `users`");
    }

    [Fact]
    public async Task GetUsers_PagesDoNotOverlap_AndCoverWholeSet()
    {
        SetBearerToken(ManagerToken);
        var page1 = await _client.GetFromJsonAsync<UsersPageResponse>("/users?page=1&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);
        var page2 = await _client.GetFromJsonAsync<UsersPageResponse>("/users?page=2&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);
        var page3 = await _client.GetFromJsonAsync<UsersPageResponse>("/users?page=3&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);

        SetBearerToken(ManagerToken);
        Assert.NotNull(page1);
        Assert.NotNull(page2);
        Assert.NotNull(page3);
        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(2, page2.Items.Count);
        var allIds = page1.Items.Concat(page2.Items).Concat(page3.Items).Select(u => u.Id).ToList();
        Assert.Equal(allIds.Count, allIds.Distinct().Count());
        Assert.True(page3.Items.Count >= 1);
    }

    [Fact]
    public async Task GetUsers_RoleFilter_TotalCountsAfterFilter()
    {
        SetBearerToken(ManagerToken);
        var result = await _client.GetFromJsonAsync<UsersPageResponse>("/users?page=1&pageSize=10&role=SALESPERSON", CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(3, result.Total); // seed: exactly 3 SALESPERSON users
        Assert.All(result.Items, u => Assert.Equal(UserRole.SALESPERSON.ToString(), u.Role));
        Assert.True(result.Items.Count <= 10);
    }

    [Fact]
    public async Task GetUsers_InvalidRole_Returns400()
    {
        SetBearerToken(ManagerToken);
        var response = await _client.GetAsync("/users?page=1&pageSize=10&role=BANANA");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.TryGetProperty("details", out _));
    }

    [Fact]
    public async Task GetUsers_InvalidPageSize_Returns400()
    {
        SetBearerToken(ManagerToken);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/users?page=1&pageSize=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/users?page=1&pageSize=201")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/users?page=0")).StatusCode);
    }

    [Fact]
    public async Task GetUsers_UnlinkedOnly_ReturnsOnlyUnlinkedSalespersonUsers()
    {
        SetBearerToken(ManagerToken);
        var result = await _client.GetFromJsonAsync<UsersPageResponse>("/users?page=1&pageSize=10&unlinkedOnly=true", CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(2, result.Total); // seed: sales2 (no salesperson row) + inactive user
        Assert.All(result.Items, u =>
        {
            Assert.Equal(UserRole.SALESPERSON.ToString(), u.Role);
            Assert.False(u.IsSalespersonLinked);
        });
    }

    [Fact]
    public async Task GetUsers_QFilter_MatchesEmailNameOrSalesperson()
    {
        SetBearerToken(ManagerToken);
        var result = await _client.GetFromJsonAsync<UsersPageResponse>("/users?page=1&pageSize=10&q=sales2", CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(1, result.Total);
        Assert.Contains(result.Items, u => u.Email == "sales2@example.com");
    }

    [Fact]
    public async Task GetApiUsers_Paged_MatchesDirectRoute()
    {
        SetBearerToken(ManagerToken);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/users?page=1&pageSize=2");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ManagerToken);
        var gateway = await _client.SendAsync(request);

        var direct = await _client.GetAsync("/users?page=1&pageSize=2");

        Assert.Equal(HttpStatusCode.OK, gateway.StatusCode);
        Assert.Equal(await direct.Content.ReadAsStringAsync(), await gateway.Content.ReadAsStringAsync());
    }

    // --------------------------------------------------------------- hospitals

    [Fact]
    public async Task GetHospitals_WithoutPageParams_ReturnsLegacyFullListShape()
    {
        SetBearerToken(ManagerToken);
        using var doc = await GetJsonAsync("/hospitals");

        Assert.True(doc.RootElement.TryGetProperty("hospitals", out var hospitals));
        Assert.True(hospitals.GetArrayLength() >= 3);
        Assert.False(doc.RootElement.TryGetProperty("items", out _));
    }

    [Fact]
    public async Task GetHospitals_WithPageParams_ReturnsPagedContractShape()
    {
        SetBearerToken(ManagerToken);
        var page1 = await _client.GetFromJsonAsync<HospitalsPageResponse>("/hospitals?page=1&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);
        var page2 = await _client.GetFromJsonAsync<HospitalsPageResponse>("/hospitals?page=2&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(page1);
        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(3, page1.Total); // seed: exactly 3 hospitals
        Assert.Equal(1, page1.Page);
        Assert.Equal(2, page1.PageSize);
        Assert.NotNull(page2);
        Assert.Single(page2.Items);
        Assert.False(page1.Items.Select(h => h.Id).Intersect(page2.Items.Select(h => h.Id)).Any());
    }

    [Fact]
    public async Task GetHospitals_QFilter_TotalCountsAfterFilter()
    {
        SetBearerToken(ManagerToken);
        var url = $"/hospitals?page=1&pageSize=2&q={Uri.EscapeDataString("ศิริราช")}";
        var result = await _client.GetFromJsonAsync<HospitalsPageResponse>(url, CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(2, result.Total); // seed: ศิริราช 1 + ศิริราช 2
        Assert.All(result.Items, h => Assert.Contains("ศิริราช", h.DisplayName));
    }

    [Fact]
    public async Task GetHospitals_InvalidPageSize_Returns400()
    {
        SetBearerToken(ManagerToken);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/hospitals?page=1&pageSize=abc")).StatusCode);
    }

    // ---------------------------------------------------------- import-batches

    [Fact]
    public async Task GetImportBatches_WithoutPageParams_ReturnsLegacyFullListShape()
    {
        SetBearerToken(ManagerToken);
        using var doc = await GetJsonAsync("/import-batches");

        Assert.True(doc.RootElement.TryGetProperty("importBatches", out var batches));
        Assert.True(batches.GetArrayLength() >= 1);
        Assert.False(doc.RootElement.TryGetProperty("items", out _));
    }

    [Fact]
    public async Task GetImportBatches_WithPageParams_ReturnsPagedContractShape()
    {
        SetBearerToken(ManagerToken);
        using var doc = await GetJsonAsync("/import-batches?page=1&pageSize=10");

        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("items", out var items));
        Assert.Equal(1, items.GetArrayLength()); // seed: 1 batch
        Assert.Equal(1, root.GetProperty("total").GetInt32());
        Assert.Equal(1, root.GetProperty("page").GetInt32());
        Assert.Equal(10, root.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task GetImportBatches_StatusFilter_TotalCountsAfterFilter()
    {
        SetBearerToken(ManagerToken);
        var success = await _client.GetFromJsonAsync<JsonDocument>("/import-batches?page=1&pageSize=10&status=SUCCESS", CustomWebApplicationFactory.DefaultJsonOptions);
        var failed = await _client.GetFromJsonAsync<JsonDocument>("/import-batches?page=1&pageSize=10&status=FAILED", CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(success);
        Assert.Equal(1, success.RootElement.GetProperty("total").GetInt32());
        Assert.NotNull(failed);
        Assert.Equal(0, failed.RootElement.GetProperty("total").GetInt32());
        Assert.Empty(failed.RootElement.GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task GetImportBatches_InvalidStatus_Returns400()
    {
        SetBearerToken(ManagerToken);
        var response = await _client.GetAsync("/import-batches?page=1&pageSize=10&status=WRONG");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // -------------------------------------------------------- target revisions

    [Fact]
    public async Task GetTargetRevisions_PagedContract_TotalOrderAndPaging()
    {
        SetBearerToken(ManagerToken);
        // Build 3 revisions on an isolated period: CREATE + 2 UPDATEs.
        int targetId = 0;
        foreach (var revenue in new[] { 610000m, 620000m, 630000m })
        {
            var payload = new { revenueTarget = revenue, newCustomerTarget = 2 };
            var put = await _client.PutAsJsonAsync($"/targets/territory/{_factory.TerritoryId1}/2031/1", payload);
            Assert.True(put.IsSuccessStatusCode, $"target PUT failed: {put.StatusCode}");

            using var putDoc = JsonDocument.Parse(await put.Content.ReadAsStringAsync());
            targetId = putDoc.RootElement.GetProperty("target").GetProperty("id").GetInt32();
        }
        Assert.True(targetId > 0);

        var page1 = await _client.GetFromJsonAsync<TargetRevisionsPageResponse>($"/targets/{targetId}/revisions?page=1&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);
        var page2 = await _client.GetFromJsonAsync<TargetRevisionsPageResponse>($"/targets/{targetId}/revisions?page=2&pageSize=2", CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(page1);
        Assert.Equal(3, page1.Total);
        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(2, page1.PageSize);
        Assert.True(page1.Items[0].Id > page1.Items[1].Id, "revisions must stay newest-first inside a page");
        Assert.NotNull(page2);
        Assert.Single(page2.Items);
        Assert.False(page1.Items.Select(r => r.Id).Intersect(page2.Items.Select(r => r.Id)).Any());
    }

    [Fact]
    public async Task GetTargetRevisions_WithoutPageParams_ReturnsLegacyShape()
    {
        SetBearerToken(ManagerToken);
        // Own isolated period so this test does not depend on the paged test's PUTs.
        var payload = new { revenueTarget = 640000m, newCustomerTarget = 1 };
        var put = await _client.PutAsJsonAsync($"/targets/territory/{_factory.TerritoryId2}/2031/2", payload);
        Assert.True(put.IsSuccessStatusCode, $"target PUT failed: {put.StatusCode}");

        using var putDoc = JsonDocument.Parse(await put.Content.ReadAsStringAsync());
        var targetId = putDoc.RootElement.GetProperty("target").GetProperty("id").GetInt32();

        using var doc = await GetJsonAsync($"/targets/{targetId}/revisions");

        Assert.True(doc.RootElement.TryGetProperty("revisions", out var revisions));
        Assert.Equal(1, revisions.GetArrayLength());
        Assert.False(doc.RootElement.TryGetProperty("items", out _));
    }

    [Fact]
    public async Task GetTargetRevisions_UnknownTarget_BothShapes_Returns404()
    {
        SetBearerToken(ManagerToken);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/targets/99999/revisions")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/targets/99999/revisions?page=1&pageSize=10")).StatusCode);
    }

    [Fact]
    public async Task GetTargetRevisions_InvalidPageSize_Returns400()
    {
        SetBearerToken(ManagerToken);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync($"/targets/{_factory.TerritoryId1}/revisions?page=1&pageSize=999")).StatusCode);
    }
}
