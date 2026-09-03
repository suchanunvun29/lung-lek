namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class ErrorContractTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public static readonly Dictionary<string, string> KnownErrorTranslations = new()
    {
        { "Invalid email or password", "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
        { "Current password is incorrect", "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
        { "A user with this email already exists", "มีอีเมลนี้ในระบบอยู่แล้ว" },
        { "User not found", "ไม่พบผู้ใช้นี้ในระบบ" },
        { "Salesperson not found", "ไม่พบพนักงานขายรายนี้" },
        { "This salesperson is already linked to another user", "พนักงานขายรายนี้ผูกกับบัญชีอื่นอยู่แล้ว" },
        { "Missing or invalid Authorization header", "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" },
        { "Invalid or expired token", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง" },
        { "User not found or inactive", "บัญชีนี้ถูกปิดใช้งานหรือไม่พบในระบบ" },
        { "Forbidden: insufficient role", "คุณไม่มีสิทธิ์ทำรายการนี้" },
        { "File is required (field name: file)", "กรุณาเลือกไฟล์ก่อนอัปโหลด" },
        { "Only .xlsx files are supported", "รองรับเฉพาะไฟล์ .xlsx เท่านั้น" },
        { "Hospital not found", "ไม่พบโรงพยาบาลนี้" },
        { "This user is already linked to another salesperson", "บัญชีนี้ผูกกับพนักงานขายรายอื่นอยู่แล้ว" },
        { "Upload error: File too large", "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 20MB)" },
        { "Target not found", "ไม่พบเป้าหมายนี้ในระบบ" },
        { "Import already in progress", "มีการนำเข้าข้อมูลอื่นกำลังดำเนินการอยู่ กรุณารอสักครู่แล้วลองใหม่" }
    };

    public ErrorContractTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public void VerifyAll17ErrorMessagesAreMapped()
    {
        Assert.Equal(17, KnownErrorTranslations.Count);
        foreach (var (eng, thai) in KnownErrorTranslations)
        {
            Assert.False(string.IsNullOrWhiteSpace(eng));
            Assert.False(string.IsNullOrWhiteSpace(thai));
        }
    }

    [Fact]
    public async Task MissingAuthHeader_ReturnsExactErrorMessage()
    {
        var response = await _client.GetAsync("/users");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = json.GetProperty("error").GetString()!;
        Assert.Equal("Missing or invalid Authorization header", error);
        Assert.True(KnownErrorTranslations.ContainsKey(error));
    }

    [Fact]
    public async Task InvalidToken_ReturnsExactErrorMessage()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "invalid-token-string");

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = json.GetProperty("error").GetString()!;
        Assert.Equal("Invalid or expired token", error);
        Assert.True(KnownErrorTranslations.ContainsKey(error));
    }

    [Fact]
    public async Task InactiveUser_ReturnsExactErrorMessage()
    {
        var token = _factory.CreateToken(_factory.InactiveUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/hospitals");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = json.GetProperty("error").GetString()!;
        Assert.Equal("User not found or inactive", error);
        Assert.True(KnownErrorTranslations.ContainsKey(error));
    }

    [Fact]
    public async Task InsufficientRole_ReturnsExactErrorMessage()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = json.GetProperty("error").GetString()!;
        Assert.Equal("Forbidden: insufficient role", error);
        Assert.True(KnownErrorTranslations.ContainsKey(error));
    }

    [Fact]
    public async Task HospitalNotFound_ReturnsExactErrorMessage()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Patch, "/hospitals/999999");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { displayName = "New Name" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = json.GetProperty("error").GetString()!;
        Assert.Equal("Hospital not found", error);
        Assert.True(KnownErrorTranslations.ContainsKey(error));
    }

    [Fact]
    public async Task SalespersonNotFound_ReturnsExactErrorMessage()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Patch, "/salespeople/999999");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { displayName = "New Name" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = json.GetProperty("error").GetString()!;
        Assert.Equal("Salesperson not found", error);
        Assert.True(KnownErrorTranslations.ContainsKey(error));
    }
}
