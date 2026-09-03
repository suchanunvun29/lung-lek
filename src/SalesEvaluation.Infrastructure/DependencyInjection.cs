namespace SalesEvaluation.Infrastructure;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Enums;
using SalesEvaluation.Infrastructure.Authentication;
using SalesEvaluation.Infrastructure.Concurrency;
using SalesEvaluation.Infrastructure.Excel;
using SalesEvaluation.Infrastructure.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");
        }
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "Host=localhost;Database=sales_eval;Username=postgres;Password=postgres";
        }

        connectionString = NormalizePostgresConnectionString(connectionString);

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
        dataSourceBuilder.MapEnum<UserRole>("UserRole");
        dataSourceBuilder.MapEnum<ProductSource>("ProductSource");
        dataSourceBuilder.MapEnum<ImportStatus>("ImportStatus");
        dataSourceBuilder.MapEnum<ImportMode>("ImportMode");
        dataSourceBuilder.MapEnum<ArchiveReason>("ArchiveReason");
        dataSourceBuilder.MapEnum<ImportIssueLevel>("ImportIssueLevel");
        dataSourceBuilder.MapEnum<TargetScope>("TargetScope");
        dataSourceBuilder.MapEnum<TargetChangeType>("TargetChangeType");
        dataSourceBuilder.MapEnum<HospitalCategory>("HospitalCategory");
        dataSourceBuilder.MapEnum<PotentialMetricKey>("PotentialMetricKey");
        dataSourceBuilder.MapEnum<RegistryLinkStatus>("RegistryLinkStatus");
        dataSourceBuilder.MapEnum<RegistryLinkMethod>("RegistryLinkMethod");
        dataSourceBuilder.MapEnum<TerritoryLinkSource>("TerritoryLinkSource");
        dataSourceBuilder.MapEnum<KpiMetric>("KpiMetric");
        dataSourceBuilder.MapEnum<PeriodType>("PeriodType");
        dataSourceBuilder.MapEnum<InsightStatus>("InsightStatus");
        dataSourceBuilder.MapEnum<NameDecisionSource>("NameDecisionSource");
        dataSourceBuilder.MapEnum<NameReviewStatus>("NameReviewStatus");

        var dataSource = dataSourceBuilder.Build();

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(dataSource).UseCamelCaseNamingConvention();
        });

        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
        services.AddHttpContextAccessor();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IJwtTokenProvider, JwtTokenProvider>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IPostgresAdvisoryLockService, PostgresAdvisoryLockService>();

        // Phase D: Excel ingestion, Gemini AI, report generation
        services.AddHttpClient("gemini");
        services.AddSingleton<GeminiApiClient>();
        services.AddScoped<IGeminiService, GeminiService>();
        services.AddScoped<IImportService, ImportService>();
        services.AddScoped<IExcelReportService, ExcelReportService>();

        return services;
    }

    private static string NormalizePostgresConnectionString(string connectionString)
    {
        if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
            connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var uri = new Uri(connectionString);
                var userInfo = uri.UserInfo.Split(':');
                var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : string.Empty;
                var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
                var database = uri.AbsolutePath.TrimStart('/');
                var port = uri.Port > 0 ? uri.Port : 5432;

                var builder = new NpgsqlConnectionStringBuilder
                {
                    Host = uri.Host,
                    Port = port,
                    Database = database,
                    Username = username,
                    Password = password
                };

                return builder.ConnectionString;
            }
            catch
            {
                return connectionString;
            }
        }

        return connectionString;
    }
}
