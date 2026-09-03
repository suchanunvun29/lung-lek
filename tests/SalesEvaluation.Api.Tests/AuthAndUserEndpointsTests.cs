namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class AuthAndUserEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuthAndUserEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_InvalidCredentials_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/auth/login", new
        {
            email = "invalid@example.com",
            password = "wrong-password"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Invalid email or password", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task ChangePassword_WithoutAuth_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/auth/change-password", new
        {
            currentPassword = "old",
            newPassword = "newpassword123"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Missing or invalid Authorization header", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task GetUsers_AsManager_ReturnsUserList()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("users", out var usersArray));
        Assert.True(usersArray.GetArrayLength() > 0);
    }

    [Fact]
    public async Task GetUsers_AsSalesperson_ReturnsForbidden()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task MustChangePassword_BlocksProtectedEndpointsWith403()
    {
        var token = _factory.CreateToken(_factory.MustChangePasswordUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("MUST_CHANGE_PASSWORD", json.GetProperty("code").GetString());
    }
}
