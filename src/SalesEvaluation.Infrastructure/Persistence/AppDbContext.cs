namespace SalesEvaluation.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
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

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
