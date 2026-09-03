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
}
