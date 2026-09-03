namespace SalesEvaluation.Infrastructure.Persistence;

using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query.SqlExpressions;
using SalesEvaluation.Application.Common;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Domain.Entities;
using SalesEvaluation.Domain.Enums;

public class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Salesperson> Salespeople => Set<Salesperson>();
    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<HospitalAlias> HospitalAliases => Set<HospitalAlias>();
    public DbSet<HospitalNameReview> HospitalNameReviews => Set<HospitalNameReview>();
    public DbSet<ProductType> ProductTypes => Set<ProductType>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductAlias> ProductAliases => Set<ProductAlias>();
    public DbSet<SalesmanNameReview> SalesmanNameReviews => Set<SalesmanNameReview>();
    public DbSet<SalesmanNameRule> SalesmanNameRules => Set<SalesmanNameRule>();
    public DbSet<SalesmanNameRuleMember> SalesmanNameRuleMembers => Set<SalesmanNameRuleMember>();
    public DbSet<SalesLine> SalesLines => Set<SalesLine>();
    public DbSet<SalesLineCredit> SalesLineCredits => Set<SalesLineCredit>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<ImportIssue> ImportIssues => Set<ImportIssue>();
    public DbSet<SalesLineArchive> SalesLineArchives => Set<SalesLineArchive>();
    public DbSet<Region> Regions => Set<Region>();
    public DbSet<ProvinceMapping> ProvinceMappings => Set<ProvinceMapping>();
    public DbSet<ProvinceAlias> ProvinceAliases => Set<ProvinceAlias>();
    public DbSet<Territory> Territories => Set<Territory>();
    public DbSet<TerritoryAssignment> TerritoryAssignments => Set<TerritoryAssignment>();
    public DbSet<TerritoryGroup> TerritoryGroups => Set<TerritoryGroup>();
    public DbSet<TerritoryGroupMember> TerritoryGroupMembers => Set<TerritoryGroupMember>();
    public DbSet<HospitalTerritoryChange> HospitalTerritoryChanges => Set<HospitalTerritoryChange>();
    public DbSet<HospitalRegistry> HospitalRegistries => Set<HospitalRegistry>();
    public DbSet<HospitalPotentialMetric> HospitalPotentialMetrics => Set<HospitalPotentialMetric>();
    public DbSet<HospitalRegistryLink> HospitalRegistryLinks => Set<HospitalRegistryLink>();
    public DbSet<TierWeight> TierWeights => Set<TierWeight>();
    public DbSet<Target> Targets => Set<Target>();
    public DbSet<TargetProductGroup> TargetProductGroups => Set<TargetProductGroup>();
    public DbSet<TargetRevision> TargetRevisions => Set<TargetRevision>();
    public DbSet<ScoringWeight> ScoringWeights => Set<ScoringWeight>();
    public DbSet<ScoringWeightRevision> ScoringWeightRevisions => Set<ScoringWeightRevision>();
    public DbSet<EvaluationSetting> EvaluationSettings => Set<EvaluationSetting>();
    public DbSet<CoachingInsight> CoachingInsights => Set<CoachingInsight>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Register PostgreSQL custom enum types
        modelBuilder.HasPostgresEnum<UserRole>("UserRole");
        modelBuilder.HasPostgresEnum<ProductSource>("ProductSource");
        modelBuilder.HasPostgresEnum<ImportStatus>("ImportStatus");
        modelBuilder.HasPostgresEnum<ImportMode>("ImportMode");
        modelBuilder.HasPostgresEnum<ArchiveReason>("ArchiveReason");
        modelBuilder.HasPostgresEnum<ImportIssueLevel>("ImportIssueLevel");
        modelBuilder.HasPostgresEnum<TargetScope>("TargetScope");
        modelBuilder.HasPostgresEnum<TargetChangeType>("TargetChangeType");
        modelBuilder.HasPostgresEnum<HospitalCategory>("HospitalCategory");
        modelBuilder.HasPostgresEnum<PotentialMetricKey>("PotentialMetricKey");
        modelBuilder.HasPostgresEnum<RegistryLinkStatus>("RegistryLinkStatus");
        modelBuilder.HasPostgresEnum<RegistryLinkMethod>("RegistryLinkMethod");
        modelBuilder.HasPostgresEnum<TerritoryLinkSource>("TerritoryLinkSource");
        modelBuilder.HasPostgresEnum<KpiMetric>("KpiMetric");
        modelBuilder.HasPostgresEnum<PeriodType>("PeriodType");
        modelBuilder.HasPostgresEnum<InsightStatus>("InsightStatus");
        modelBuilder.HasPostgresEnum<NameDecisionSource>("NameDecisionSource");
        modelBuilder.HasPostgresEnum<NameReviewStatus>("NameReviewStatus");

        MapMonthKeyFunction(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    // PeriodUtils.MonthKey() collapses a (year, month) pair into one sortable int, and the KPI /
    // leaderboard / report / target-suggestion queries filter on it server-side
    // (monthKeys.Contains(MonthKey(sl.Year, sl.Month))). EF cannot translate a call to an ordinary
    // static method, so every one of those queries used to throw "could not be translated" at
    // runtime. Teaching EF the arithmetic here keeps the formula in a single place — the
    // alternative was inlining `Year * 12 + Month - 1` at ~24 call sites, where the next query
    // added would silently reintroduce the same failure.
    private static void MapMonthKeyFunction(ModelBuilder modelBuilder)
    {
        var monthKey = typeof(PeriodUtils).GetMethod(
            nameof(PeriodUtils.MonthKey),
            new[] { typeof(int), typeof(int) })!;

        modelBuilder.HasDbFunction(monthKey).HasTranslation(args =>
        {
            var year = args[0];
            var month = args[1];
            var mapping = year.TypeMapping ?? month.TypeMapping;

            // year * 12 + month - 1
            var scaledYear = new SqlBinaryExpression(
                ExpressionType.Multiply, year, new SqlConstantExpression(12, mapping), typeof(int), mapping);
            var plusMonth = new SqlBinaryExpression(
                ExpressionType.Add, scaledYear, month, typeof(int), mapping);
            return new SqlBinaryExpression(
                ExpressionType.Subtract, plusMonth, new SqlConstantExpression(1, mapping), typeof(int), mapping);
        });
    }
}
