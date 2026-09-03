using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Json;
using SalesEvaluation.Api.Converters;
using SalesEvaluation.Api.Endpoints;
using SalesEvaluation.Api.Middleware;
using SalesEvaluation.Application;
using SalesEvaluation.Infrastructure;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Structured logging with Serilog
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// Configure JSON options
builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.Converters.Add(new DecimalToStringConverter());
    options.SerializerOptions.Converters.Add(new NullableDecimalToStringConverter());
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    // Express returns raw UTF-8 (Thai strings are not \u-escaped) — match that contract.
    options.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
});

// Configure CORS — origins are set in appsettings.json under "AllowedOrigins"
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins is { Length: > 0 })
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        else
            // Development fallback — must be overridden in production via AllowedOrigins config
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});

// Register layer services
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// Add Health Checks
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseSerilogRequestLogging();

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

app.UseCors();

// Authentication middleware — runs before every endpoint.
// Public paths (/health) are whitelisted inside the middleware itself.
// When adding new public endpoints (e.g. /auth/login), add them to the whitelist there.
app.UseMiddleware<AuthenticationMiddleware>();

// Health Check Endpoint — whitelisted in AuthenticationMiddleware (no token required)
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Map Service Endpoints
app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapProductEndpoints();
app.MapSalespersonEndpoints();
app.MapHospitalEndpoints();
app.MapReviewQueueEndpoints();
app.MapTerritoryEndpoints();
app.MapTerritoryGroupEndpoints();
app.MapRegistryEndpoints();
app.MapTerritoryViewEndpoints();
app.MapTargetEndpoints();
app.MapTargetSuggestionEndpoints();
app.MapKpiEndpoints();
app.MapTerritoryKpiEndpoints();
app.MapLeaderboardEndpoints();
app.MapTerritoryProductRankingEndpoints();
app.MapSettingsEndpoints();
app.MapImportEndpoints();
app.MapCoachingInsightEndpoints();
app.MapReportEndpoints();

// Fallback 404 handler matching Express not found behavior
app.MapFallback((HttpContext context) =>
    Results.Json(new { error = "Not found" }, statusCode: StatusCodes.Status404NotFound));

app.Run();

public partial class Program { }
