namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
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

    // ─── T-UX-022: conflict codes ───────────────────────────────────────────

    [Fact]
    public async Task DuplicateAlias_Returns409WithAliasDuplicateCode()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/hospitals/{_factory.HospitalId1}/aliases");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { sampleRaw = "รพ.เชียงใหม่ (ซ้ำ)", normalizedKey = "CHIANGMAI" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("already exists", json.GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("ALIAS_DUPLICATE", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task ReviewAlreadyDecided_Returns409WithReviewAlreadyDecidedCode()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);

        using var first = new HttpRequestMessage(HttpMethod.Patch, $"/hospital-name-reviews/{_factory.HospitalReviewId1}");
        first.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        first.Content = JsonContent.Create(new { decision = "KEPT_SEPARATE" });
        var firstResponse = await _client.SendAsync(first);
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        using var second = new HttpRequestMessage(HttpMethod.Patch, $"/hospital-name-reviews/{_factory.HospitalReviewId1}");
        second.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        second.Content = JsonContent.Create(new { decision = "KEPT_SEPARATE" });
        var secondResponse = await _client.SendAsync(second);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);

        var json = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("ถูกตัดสินไปแล้ว", json.GetProperty("error").GetString());
        Assert.Equal("REVIEW_ALREADY_DECIDED", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task SalespersonAlreadyAssignedToAnotherUser_Returns409WithAssignmentConflictCode()
    {
        // Seeded: salesperson 1 is linked to user 2 — assigning it to user 3 hits the
        // link-assignment conflict. (The territory-assignment unique-constraint path
        // cannot be reproduced on the EF InMemory test provider, which does not
        // enforce relational unique indexes; its envelope is pinned by
        // GlobalExceptionHandlerMiddlewareTests.ConflictException_WithCode.)
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/users/{_factory.Salesperson2UserId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { salespersonId = _factory.SalespersonId1 });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("already linked", json.GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("ASSIGNMENT_CONFLICT", json.GetProperty("code").GetString());
    }

    // ─── T-UX-023: invalid input → 400 (no silent no-op) ────────────────────

    [Fact]
    public async Task PatchUserWithInvalidRole_Returns400WithThaiFieldMessage()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/users/{_factory.Salesperson2UserId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { role = "MANGER" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("role ไม่ถูกต้อง", json.GetProperty("details").GetString());
    }

    [Fact]
    public async Task PatchUserWithValidRole_StillSucceeds()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/users/{_factory.Salesperson2UserId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { role = "SALESPERSON" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task KpiDrillDownWithNonNumericHospitalId_Returns400WithThaiFieldMessage()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/kpi/{_factory.SalespersonId1}/drill-down/REVENUE_VS_TARGET?periodType=YEAR&year=2026&hospitalId=abc");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("hospitalId ไม่ถูกต้อง", json.GetProperty("details").GetString());
    }

    [Fact]
    public async Task KpiDrillDownWithNumericHospitalId_StillSucceeds()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/kpi/{_factory.SalespersonId1}/drill-down/REVENUE_VS_TARGET?periodType=YEAR&year=2026&hospitalId={_factory.HospitalId1}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task TerritoryViewWithNonNumericProductTypeId_Returns400WithThaiFieldMessage()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/my-territory-view/{_factory.SalespersonId1}?periodType=YEAR&year=2026&productTypeId=abc");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("productTypeId ไม่ถูกต้อง", json.GetProperty("details").GetString());
    }

    [Fact]
    public async Task TerritoryViewWithNumericProductTypeId_StillSucceeds()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/my-territory-view/{_factory.SalespersonId1}?periodType=YEAR&year=2026&productTypeId={_factory.ProductTypeId1}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ─── T-UX-024: password policy + login rate limit ───────────────────────

    [Fact]
    public async Task ChangePasswordWithShortPassword_Returns400WithThaiMessage()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/change-password");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { currentPassword = "whatever1", newPassword = "short7" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร", json.GetProperty("details").GetString());
    }

    [Fact]
    public async Task ChangePasswordWithEightCharPassword_PassesLengthGate()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/change-password");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { currentPassword = "whatever1", newPassword = "8charsok" });

        var response = await _client.SendAsync(request);
        // Seed user's password hash is not a real BCrypt hash, so the current-password
        // check fails with 401 — reaching that (not 400) proves the length gate passed.
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Current password is incorrect", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task ResetPasswordWithShortTemporaryPassword_Returns400()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/users/{_factory.Salesperson2UserId}/reset-password");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new { temporaryPassword = "abc" });

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("รหัสผ่านชั่วคราวต้องมีอย่างน้อย 8 ตัวอักษร", json.GetProperty("details").GetString());
    }

    [Fact]
    public async Task ResetPasswordWithGeneratedTemporaryPassword_MeetsMinimumLength_AndFirstLoginFlowWorks()
    {
        var managerToken = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var resetRequest = new HttpRequestMessage(HttpMethod.Post, $"/users/{_factory.Salesperson2UserId}/reset-password");
        resetRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", managerToken);
        resetRequest.Content = JsonContent.Create(new { });

        var resetResponse = await _client.SendAsync(resetRequest);
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);

        var resetJson = await resetResponse.Content.ReadFromJsonAsync<JsonElement>();
        var tempPassword = resetJson.GetProperty("temporaryPassword").GetString()!;
        Assert.True(tempPassword.Length >= 8, $"generated temporary password must be >= 8 chars, got {tempPassword.Length}");

        var loginResponse = await _client.PostAsJsonAsync("/auth/login", new { email = "sales2@example.com", password = tempPassword });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(loginJson.GetProperty("user").GetProperty("mustChangePassword").GetBoolean());
    }

    [Fact]
    public async Task RepeatedFailedLogins_BecomeRateLimitedWith429AndThaiMessage()
    {
        const string email = "bruteforce@example.com";
        for (var i = 0; i < 5; i++)
        {
            var failed = await _client.PostAsJsonAsync("/auth/login", new { email, password = "wrong-pass-1" });
            Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
        }

        var blocked = await _client.PostAsJsonAsync("/auth/login", new { email, password = "right-pass-9" });
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);

        var json = await blocked.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("RATE_LIMITED", json.GetProperty("code").GetString());
        Assert.Contains("เข้าสู่ระบบ", json.GetProperty("error").GetString());
    }

    [Fact]
    public async Task FailedLoginForDifferentEmail_IsNotBlocked()
    {
        var failed = await _client.PostAsJsonAsync("/auth/login", new { email = "other-user@example.com", password = "wrong-pass-1" });
        Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
        var json = await failed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Invalid email or password", json.GetProperty("error").GetString());
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
