namespace SalesEvaluation.Api.Tests;

using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using SalesEvaluation.Api.Converters;
using SalesEvaluation.Contracts.TerritoryViews;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class DecimalSerializationParityTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public DecimalSerializationParityTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public void DecimalToStringConverter_SerializesDecimalAsString()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        options.Converters.Add(new DecimalToStringConverter());
        options.Converters.Add(new NullableDecimalToStringConverter());

        var testObj = new
        {
            Total = 1234.56m,
            Vat = 86.42m,
            NullableValue = (decimal?)99.90m,
            NullValue = (decimal?)null
        };

        var json = JsonSerializer.Serialize(testObj, options);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(JsonValueKind.String, root.GetProperty("total").ValueKind);
        Assert.Equal("1234.56", root.GetProperty("total").GetString());

        Assert.Equal(JsonValueKind.String, root.GetProperty("vat").ValueKind);
        Assert.Equal("86.42", root.GetProperty("vat").GetString());

        Assert.Equal(JsonValueKind.String, root.GetProperty("nullableValue").ValueKind);
        Assert.Equal("99.90", root.GetProperty("nullableValue").GetString());

        Assert.Equal(JsonValueKind.Null, root.GetProperty("nullValue").ValueKind);
    }

    [Fact]
    public async Task TerritoryViewEndpoint_DecimalFieldsAreSerializedAsStrings()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/my-territory-view/{_factory.SalespersonId1}?periodType=YEAR&year=2026");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var jsonStr = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(jsonStr);
        var root = doc.RootElement;

        // Verify root structure
        Assert.True(root.TryGetProperty("soldHospitals", out var soldHospitals));
        if (soldHospitals.GetArrayLength() > 0)
        {
            var firstRow = soldHospitals[0];
            if (firstRow.TryGetProperty("revenue", out var revenueProp))
            {
                Assert.Equal(JsonValueKind.String, revenueProp.ValueKind);
            }
        }
    }

    [Fact]
    public async Task HospitalRegistry_DecimalFieldsAreSerializedAsStrings()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/hospital-registries");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var jsonStr = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(jsonStr);
        var root = doc.RootElement;

        Assert.True(root.TryGetProperty("hospitalRegistries", out var list));
        if (list.GetArrayLength() > 0)
        {
            var first = list[0];
            if (first.TryGetProperty("potentialAdjustment", out var adjProp))
            {
                Assert.Equal(JsonValueKind.String, adjProp.ValueKind);
            }
        }
    }
}
