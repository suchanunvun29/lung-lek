namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class ImportAndReportEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ImportAndReportEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetImportBatches_ReturnsBatches()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/import-batches");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("importBatches", out _));
    }

    [Fact]
    public async Task GetSalesLines_ReturnsSalesLinesList()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/sales-lines?year=2026&month=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("data", out _) || json.TryGetProperty("salesLines", out _));
    }

    [Fact]
    public async Task Upload_InvalidExtension_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[] { 1, 2, 3 });
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        content.Add(fileContent, "file", "test.txt");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/import");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = content;

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Only .xlsx files are supported", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Upload_MissingFile_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var content = new MultipartFormDataContent();
        content.Add(new StringContent("APPEND"), "mode");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/import");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = content;

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("File is required (field name: file)", json.GetProperty("error").GetString());
    }

    // ---- WACC-P0-001: GET /reports/individual/{salespersonId} ----

    [Fact]
    public async Task GetIndividualReport_ReturnsJsonData()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/reports/individual/{_factory.SalespersonId1}?periodType=MONTH&year=2026&periodNumber=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("salesperson", out var sp));
        Assert.Equal(_factory.SalespersonId1, sp.GetProperty("id").GetInt32());
        Assert.True(json.TryGetProperty("composite", out _));
        Assert.True(json.TryGetProperty("supplementary", out _));
    }

    [Fact]
    public async Task GetIndividualReport_ForbiddenForOtherSalesperson()
    {
        var token = _factory.CreateToken(_factory.Salesperson2UserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/reports/individual/{_factory.SalespersonId1}?periodType=MONTH&year=2026&periodNumber=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetIndividualReport_NotFound_Returns404()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/reports/individual/99999?periodType=MONTH&year=2026&periodNumber=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- WACC-P0-002: GET /reports/team-overview ----

    [Fact]
    public async Task GetTeamOverview_ReturnsJsonData()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/reports/team-overview?periodType=MONTH&year=2026&periodNumber=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("results", out var results));
        Assert.Equal(JsonValueKind.Array, results.ValueKind);
        Assert.True(json.TryGetProperty("period", out _));
    }

    // ---- WACC-P0-004: GET /reports/territory-overview/export ----

    [Fact]
    public async Task ExportTerritoryOverview_ReturnsXlsxFile()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/reports/territory-overview/export?periodType=MONTH&year=2026&periodNumber=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(".xlsx", response.Content.Headers.ContentDisposition?.FileName ?? "");

        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.NotEmpty(bytes);
        using var ms = new MemoryStream(bytes);
        using var workbook = new ClosedXML.Excel.XLWorkbook(ms);
        Assert.NotEmpty(workbook.Worksheets);
    }
}
