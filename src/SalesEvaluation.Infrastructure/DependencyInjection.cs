namespace SalesEvaluation.Infrastructure;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;
using Npgsql.NameTranslation;
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
        ApplyEnumMappings(new DataSourceEnumMapper(dataSourceBuilder));

        var dataSource = dataSourceBuilder.Build();

        services.AddDbContext<AppDbContext>(options =>
        {
            options
                .UseNpgsql(dataSource, npgsql => ApplyEnumMappings(new ModelEnumMapper(npgsql)))
                .UseCamelCaseNamingConvention();
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

    // Every PostgreSQL enum has to be registered twice: once on the ADO layer
    // (NpgsqlDataSourceBuilder) so values can be read/written, and once on the EF provider so it
    // knows the column is an enum. Since Npgsql.EntityFrameworkCore.PostgreSQL 9.0,
    // AppDbContext's HasPostgresEnum() only declares the type for migrations and no longer
    // registers the mapping — without the EF-side MapEnum() below, EF reads e.g. "User"."role"
    // as int and every query touching an enum column fails with InvalidCastException.
    //
    // The labels come from the original Prisma migrations and match the C# member names verbatim
    // (MANAGER, SUPERSEDED_BY_REIMPORT, …), so mapping must not go through Npgsql's default
    // snake_case name translator.
    //
    // The translator must be a single shared instance: EF compares enum mappings (translator
    // included, by reference) to decide whether two DbContext options can share one internal
    // service provider. A fresh translator per options build makes every request look distinct,
    // and EF throws ManyServiceProvidersCreatedWarning once it has built twenty of them.
    private static readonly INpgsqlNameTranslator VerbatimEnumLabels = new NpgsqlNullNameTranslator();

    private static void ApplyEnumMappings(IEnumMapper mapper)
    {
        mapper.Map<UserRole>("UserRole");
        mapper.Map<ProductSource>("ProductSource");
        mapper.Map<ImportStatus>("ImportStatus");
        mapper.Map<ImportMode>("ImportMode");
        mapper.Map<ArchiveReason>("ArchiveReason");
        mapper.Map<ImportIssueLevel>("ImportIssueLevel");
        mapper.Map<TargetScope>("TargetScope");
        mapper.Map<TargetChangeType>("TargetChangeType");
        mapper.Map<HospitalCategory>("HospitalCategory");
        mapper.Map<PotentialMetricKey>("PotentialMetricKey");
        mapper.Map<RegistryLinkStatus>("RegistryLinkStatus");
        mapper.Map<RegistryLinkMethod>("RegistryLinkMethod");
        mapper.Map<TerritoryLinkSource>("TerritoryLinkSource");
        mapper.Map<KpiMetric>("KpiMetric");
        mapper.Map<PeriodType>("PeriodType");
        mapper.Map<InsightStatus>("InsightStatus");
        mapper.Map<NameDecisionSource>("NameDecisionSource");
        mapper.Map<NameReviewStatus>("NameReviewStatus");
    }

    private interface IEnumMapper
    {
        void Map<TEnum>(string pgName) where TEnum : struct, Enum;
    }

    private sealed class DataSourceEnumMapper : IEnumMapper
    {
        private readonly NpgsqlDataSourceBuilder _builder;

        public DataSourceEnumMapper(NpgsqlDataSourceBuilder builder) => _builder = builder;

        public void Map<TEnum>(string pgName) where TEnum : struct, Enum
            => _builder.MapEnum<TEnum>(pgName, VerbatimEnumLabels);
    }

    private sealed class ModelEnumMapper : IEnumMapper
    {
        private readonly NpgsqlDbContextOptionsBuilder _builder;

        public ModelEnumMapper(NpgsqlDbContextOptionsBuilder builder) => _builder = builder;

        public void Map<TEnum>(string pgName) where TEnum : struct, Enum
            => _builder.MapEnum<TEnum>(pgName, nameTranslator: VerbatimEnumLabels);
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
