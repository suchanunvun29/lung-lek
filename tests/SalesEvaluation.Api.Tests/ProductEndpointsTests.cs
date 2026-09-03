namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.Products;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class ProductEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ProductEndpointsTests(CustomWebApplicationFactory factory)
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
    public async Task GetProducts_WithoutAuthHeader_Returns401MissingHeader()
    {
        ClearAuth();
        var response = await _client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Missing or invalid Authorization header", err.GetString());
    }

    [Fact]
    public async Task GetProducts_WithInvalidToken_Returns401InvalidToken()
    {
        SetBearerToken("invalid.jwt.token");
        var response = await _client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Invalid or expired token", err.GetString());
    }

    [Fact]
    public async Task GetProducts_WithInactiveUser_Returns401InactiveUser()
    {
        var token = _factory.CreateToken(_factory.InactiveUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var response = await _client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("User not found or inactive", err.GetString());
    }

    [Fact]
    public async Task GetProducts_WithMustChangePassword_Returns403MustChangePassword()
    {
        var token = _factory.CreateToken(_factory.MustChangePasswordUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Password change required", err.GetString());
        Assert.True(json.TryGetProperty("code", out var code));
        Assert.Equal("MUST_CHANGE_PASSWORD", code.GetString());
    }

    [Fact]
    public async Task GetProducts_WithManagerToken_Returns200AndSortedProducts()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ProductsResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.Products);
        Assert.True(result.Products.Count >= 3);

        // Sorting check: ProductType name ASC (A-Type before B-Type)
        // Within A-Type: Product Delta before Product Equipment 1
        Assert.Equal("A-Type (Equipment)", result.Products[0].ProductType.Name);
        Assert.Equal("Product Delta", result.Products[0].Name);
        Assert.Equal("A-Type (Equipment)", result.Products[1].ProductType.Name);
        Assert.Equal("Product Equipment 1", result.Products[1].Name);

        // Within B-Type: Product Alpha before Product Beta
        Assert.Equal("B-Type (Consumables)", result.Products[2].ProductType.Name);
        Assert.Equal("Product Alpha", result.Products[2].Name);
        Assert.Equal("B-Type (Consumables)", result.Products[3].ProductType.Name);
        Assert.Equal("Product Beta", result.Products[3].Name);
    }

    [Fact]
    public async Task GetProducts_WithSalespersonToken_Returns200()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var response = await _client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetProducts_GatewayRoute_ReturnsIdenticalResult()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var directResponse = await _client.GetStringAsync("/products");
        var gatewayResponse = await _client.GetStringAsync("/api/products");

        Assert.Equal(directResponse, gatewayResponse);
    }

    [Fact]
    public async Task GetProductTypes_WithValidToken_Returns200AndSortedByName()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var response = await _client.GetAsync("/product-types");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ProductTypesResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.NotNull(result.ProductTypes);
        Assert.True(result.ProductTypes.Count >= 2);

        // Sorted by name ASC: "A-Type (Equipment)" before "B-Type (Consumables)"
        Assert.Equal("A-Type (Equipment)", result.ProductTypes[0].Name);
        Assert.Equal("B-Type (Consumables)", result.ProductTypes[1].Name);
    }

    [Fact]
    public async Task GetProductTypes_GatewayRoute_ReturnsIdenticalResult()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var directResponse = await _client.GetStringAsync("/product-types");
        var gatewayResponse = await _client.GetStringAsync("/api/product-types");

        Assert.Equal(directResponse, gatewayResponse);
    }

    [Fact]
    public async Task PatchProduct_WithSalespersonToken_Returns403ForbiddenInsufficientRole()
    {
        var token = _factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON);
        SetBearerToken(token);

        var content = new StringContent(JsonSerializer.Serialize(new { displayName = "New Name" }), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/products/{_factory.ProductId1}", content);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Forbidden: insufficient role", err.GetString());
    }

    [Fact]
    public async Task PatchProduct_WithNonExistentId_Returns404ProductNotFound()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var content = new StringContent(JsonSerializer.Serialize(new { displayName = "New Name" }), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync("/products/non-existent-id-9999", content);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Product not found", err.GetString());
    }

    [Fact]
    public async Task PatchProduct_WithEmptyBody_Returns400ValidationError()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var content = new StringContent("{}", Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/products/{_factory.ProductId1}", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Validation failed", err.GetString());
    }

    [Fact]
    public async Task PatchProduct_WithInvalidDataType_Returns400ValidationError()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var content = new StringContent("{\"isActive\": \"not-a-bool\"}", Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/products/{_factory.ProductId1}", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("Validation failed", err.GetString());
    }

    [Fact]
    public async Task PatchProduct_WithManagerToken_UpdatesDisplayNameAndIsActive()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var updatePayload = new
        {
            displayName = "Updated Display Beta",
            isActive = false
        };

        var content = new StringContent(JsonSerializer.Serialize(updatePayload), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/products/{_factory.ProductId1}", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ProductResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(_factory.ProductId1, result.Product.Id);
        Assert.Equal("Updated Display Beta", result.Product.DisplayName);
        Assert.False(result.Product.IsActive);
        Assert.Equal("CODE-BETA", result.Product.Code); // Code untouched
    }

    [Fact]
    public async Task PatchProduct_ClearingCodeToNull_UpdatesSuccessfully()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var updatePayload = new
        {
            code = (string?)null
        };

        var content = new StringContent(JsonSerializer.Serialize(updatePayload), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/products/{_factory.ProductId4}", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ProductResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(_factory.ProductId4, result.Product.Id);
        Assert.Null(result.Product.Code);
    }

    [Fact]
    public async Task PatchProduct_WithDuplicateCode_Returns409ConflictThaiErrorMessage()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        // ProductId1 has code "CODE-BETA". Attempting to set ProductId2's code to "CODE-BETA"
        var updatePayload = new
        {
            code = "CODE-BETA"
        };

        var content = new StringContent(JsonSerializer.Serialize(updatePayload), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/products/{_factory.ProductId2}", content);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("error", out var err));
        Assert.Equal("รหัสสินค้านี้ถูกใช้กับสินค้าอื่นแล้ว", err.GetString());
    }

    [Fact]
    public async Task PatchProduct_ViaGatewayRoute_UpdatesSuccessfully()
    {
        var token = _factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER);
        SetBearerToken(token);

        var updatePayload = new
        {
            code = "CODE-GATEWAY-UPDATE",
            displayName = "Gateway Updated Name",
            isActive = true
        };

        var content = new StringContent(JsonSerializer.Serialize(updatePayload), Encoding.UTF8, "application/json");
        var response = await _client.PatchAsync($"/api/products/{_factory.ProductId3}", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ProductResponse>(CustomWebApplicationFactory.DefaultJsonOptions);

        Assert.NotNull(result);
        Assert.Equal(_factory.ProductId3, result.Product.Id);
        Assert.Equal("CODE-GATEWAY-UPDATE", result.Product.Code);
        Assert.Equal("Gateway Updated Name", result.Product.DisplayName);
        Assert.True(result.Product.IsActive);
    }
}
