namespace SalesEvaluation.Application;

using Microsoft.Extensions.DependencyInjection;
using SalesEvaluation.Application.Auth;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Application.Hospitals;
using SalesEvaluation.Application.HospitalRegistry;
using SalesEvaluation.Application.Kpi;
using SalesEvaluation.Application.Products;
using SalesEvaluation.Application.ReviewQueues;
using SalesEvaluation.Application.Salespeople;
using SalesEvaluation.Application.Settings;
using SalesEvaluation.Application.Targets;
using SalesEvaluation.Application.Territories;
using SalesEvaluation.Application.Users;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ISalespersonService, SalespersonService>();
        services.AddScoped<IHospitalService, HospitalService>();
        services.AddScoped<IReviewQueueService, ReviewQueueService>();
        services.AddScoped<ITerritoryScopeResolver, TerritoryScopeResolver>();
        services.AddScoped<ITerritoryService, TerritoryService>();
        services.AddScoped<IHospitalRegistryService, HospitalRegistryService>();
        services.AddScoped<ITierWeightService, TierWeightService>();
        services.AddScoped<ITerritoryViewService, TerritoryViewService>();
        services.AddScoped<ITargetService, TargetService>();
        services.AddScoped<ITargetAssistService, TargetAssistService>();
        services.AddScoped<IKpiScoringService, KpiScoringService>();
        services.AddScoped<ITerritoryKpiService, TerritoryKpiService>();
        services.AddScoped<ILeaderboardService, LeaderboardService>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddScoped<ICoachingInsightService, SalesEvaluation.Application.CoachingInsights.CoachingInsightService>();
        return services;
    }
}
