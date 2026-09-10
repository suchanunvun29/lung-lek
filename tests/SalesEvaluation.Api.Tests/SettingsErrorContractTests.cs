namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Persistence;
using Xunit;

/// <summary>
/// T-UX-022 — when the EvaluationSetting singleton row is missing (server-side
/// data fault) the API must answer a generic 500 envelope and must never render
/// the internal exception message ("...singleton row is missing...") to the client.
/// Uses its own factory so deleting the seeded row cannot affect other test classes.
/// </summary>
public class SettingsErrorContractTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public SettingsErrorContractTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetEvaluationSetting_WhenSingletonMissing_ReturnsGeneric500WithoutInternalMessage()
    {
        RemoveEvaluationSettingRow();

        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/settings/evaluation");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal("Internal server error", json.GetProperty("error").GetString());
        Assert.Equal(1, json.EnumerateObject().Count());
        Assert.DoesNotContain("singleton", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UpdateEvaluationSetting_WhenSingletonMissing_ReturnsGeneric500WithoutInternalMessage()
    {
        RemoveEvaluationSettingRow();

        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Put, "/settings/evaluation");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { aiEnabled = true });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("singleton", body, StringComparison.OrdinalIgnoreCase);
    }

    private void RemoveEvaluationSettingRow()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        foreach (var setting in db.EvaluationSettings.ToList())
        {
            db.EvaluationSettings.Remove(setting);
        }
        db.SaveChanges();
    }
}
