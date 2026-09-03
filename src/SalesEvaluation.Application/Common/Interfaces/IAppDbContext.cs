namespace SalesEvaluation.Application.Common.Interfaces;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Domain.Entities;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Salesperson> Salespeople { get; }
    DbSet<Hospital> Hospitals { get; }
    DbSet<HospitalAlias> HospitalAliases { get; }
    DbSet<HospitalNameReview> HospitalNameReviews { get; }
    DbSet<ProductType> ProductTypes { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductAlias> ProductAliases { get; }
    DbSet<SalesmanNameReview> SalesmanNameReviews { get; }
    DbSet<SalesmanNameRule> SalesmanNameRules { get; }
    DbSet<SalesmanNameRuleMember> SalesmanNameRuleMembers { get; }
    DbSet<SalesLine> SalesLines { get; }
    DbSet<SalesLineCredit> SalesLineCredits { get; }
    DbSet<ImportBatch> ImportBatches { get; }
    DbSet<ImportIssue> ImportIssues { get; }
    DbSet<SalesLineArchive> SalesLineArchives { get; }
    DbSet<Region> Regions { get; }
    DbSet<ProvinceMapping> ProvinceMappings { get; }
    DbSet<ProvinceAlias> ProvinceAliases { get; }
    DbSet<Territory> Territories { get; }
    DbSet<TerritoryAssignment> TerritoryAssignments { get; }
    DbSet<TerritoryGroup> TerritoryGroups { get; }
    DbSet<TerritoryGroupMember> TerritoryGroupMembers { get; }
    DbSet<HospitalTerritoryChange> HospitalTerritoryChanges { get; }
    DbSet<HospitalRegistry> HospitalRegistries { get; }
    DbSet<HospitalPotentialMetric> HospitalPotentialMetrics { get; }
    DbSet<HospitalRegistryLink> HospitalRegistryLinks { get; }
    DbSet<TierWeight> TierWeights { get; }
    DbSet<Target> Targets { get; }
    DbSet<TargetProductGroup> TargetProductGroups { get; }
    DbSet<TargetRevision> TargetRevisions { get; }
    DbSet<ScoringWeight> ScoringWeights { get; }
    DbSet<ScoringWeightRevision> ScoringWeightRevisions { get; }
    DbSet<EvaluationSetting> EvaluationSettings { get; }
    DbSet<CoachingInsight> CoachingInsights { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
