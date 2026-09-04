namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Json;
using Xunit;

public class CorsPolicyTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public CorsPolicyTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Preflight_VercelOrigin_ReturnsAllowedHeaders()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/auth/login");
        request.Headers.Add("Origin", "https://lung-h879gbq96-vunsen.vercel.app");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("https://lung-h879gbq96-vunsen.vercel.app", response.Headers.GetValues("Access-Control-Allow-Origin").First());
    }

    [Fact]
    public async Task Preflight_AnyVercelSubdomain_ReturnsAllowedHeaders()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/auth/login");
        request.Headers.Add("Origin", "https://random-preview-branch.vercel.app");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("https://random-preview-branch.vercel.app", response.Headers.GetValues("Access-Control-Allow-Origin").First());
    }

    [Fact]
    public async Task Preflight_Localhost_ReturnsAllowedHeaders()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/auth/login");
        request.Headers.Add("Origin", "http://localhost:3000");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("http://localhost:3000", response.Headers.GetValues("Access-Control-Allow-Origin").First());
    }

    [Fact]
    public async Task LoginPost_VercelOrigin_IncludesCorsOriginHeader()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/login");
        request.Headers.Add("Origin", "https://lung-h879gbq96-vunsen.vercel.app");
        request.Content = JsonContent.Create(new { email = "invalid@example.com", password = "wrong" });

        var response = await _client.SendAsync(request);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("https://lung-h879gbq96-vunsen.vercel.app", response.Headers.GetValues("Access-Control-Allow-Origin").First());
    }

    [Theory]
    [InlineData("https://lung-h879gbq96-vunsen.vercel.app", true)]
    [InlineData("https://my-app.vercel.app", true)]
    [InlineData("http://localhost:3000", true)]
    [InlineData("http://localhost:5173", true)]
    [InlineData("https://custom-domain.com", true)] // via configured origins
    [InlineData("https://sub.custom-domain.com", true)] // via wildcard *.custom-domain.com
    [InlineData("https://untrusted-attacker.com", false)]
    public void MatchesOrigin_EvaluatesCorrectly(string origin, bool expected)
    {
        var configured = new List<string>
        {
            "https://custom-domain.com",
            "https://*.custom-domain.com"
        };

        var actual = Program.MatchesOrigin(origin, configured);
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void MatchesOrigin_WildcardAll_AllowsAnyOrigin()
    {
        var configured = new List<string> { "*" };
        Assert.True(Program.MatchesOrigin("https://anywhere.com", configured));
        Assert.True(Program.MatchesOrigin("http://test.local:8080", configured));
    }
}
