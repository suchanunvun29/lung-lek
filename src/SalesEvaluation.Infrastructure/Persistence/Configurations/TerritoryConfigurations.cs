namespace SalesEvaluation.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalesEvaluation.Domain.Entities;

public class RegionConfiguration : IEntityTypeConfiguration<Region>
{
    public void Configure(EntityTypeBuilder<Region> builder)
    {
        builder.ToTable("Region");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name).IsRequired();
        builder.HasIndex(r => r.Name).IsUnique();

        builder.Property(r => r.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}

public class ProvinceMappingConfiguration : IEntityTypeConfiguration<ProvinceMapping>
{
    public void Configure(EntityTypeBuilder<ProvinceMapping> builder)
    {
        builder.ToTable("ProvinceMapping");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.CanonicalName).IsRequired();
        builder.HasIndex(p => p.CanonicalName).IsUnique();

        builder.Property(p => p.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(p => p.Region)
            .WithMany(r => r.Provinces)
            .HasForeignKey(p => p.RegionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProvinceAliasConfiguration : IEntityTypeConfiguration<ProvinceAlias>
{
    public void Configure(EntityTypeBuilder<ProvinceAlias> builder)
    {
        builder.ToTable("ProvinceAlias");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.NormalizedAlias).IsRequired();
        builder.HasIndex(a => a.NormalizedAlias).IsUnique();

        builder.Property(a => a.SampleRaw).IsRequired();
        builder.Property(a => a.IsDistrictLevel).HasDefaultValue(false);
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(a => a.ProvinceMapping)
            .WithMany(p => p.Aliases)
            .HasForeignKey(a => a.ProvinceMappingId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class TerritoryConfiguration : IEntityTypeConfiguration<Territory>
{
    public void Configure(EntityTypeBuilder<Territory> builder)
    {
        builder.ToTable("Territory");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).IsRequired();
        builder.HasIndex(t => t.Name).IsUnique();
        builder.HasIndex(t => t.Code).IsUnique();

        builder.Property(t => t.SortOrder).HasDefaultValue(0);
        builder.Property(t => t.IsActive).HasDefaultValue(true);
        builder.Property(t => t.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(t => t.UpdatedAt).IsRequired();

        builder.HasOne(t => t.Region)
            .WithMany(r => r.Territories)
            .HasForeignKey(t => t.RegionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class TerritoryAssignmentConfiguration : IEntityTypeConfiguration<TerritoryAssignment>
{
    public void Configure(EntityTypeBuilder<TerritoryAssignment> builder)
    {
        builder.ToTable("TerritoryAssignment");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.IsSupervisor).HasDefaultValue(false);
        builder.Property(a => a.EffectiveFrom).HasColumnType("date");
        builder.Property(a => a.EffectiveTo).HasColumnType("date");
        builder.Property(a => a.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(a => new { a.TerritoryId, a.SalespersonId, a.EffectiveFrom }).IsUnique();
        builder.HasIndex(a => new { a.TerritoryId, a.EffectiveTo });
        builder.HasIndex(a => new { a.SalespersonId, a.EffectiveTo });
        builder.HasIndex(a => new { a.SalespersonId, a.IsSupervisor, a.EffectiveTo });

        builder.HasOne(a => a.Territory)
            .WithMany(t => t.Assignments)
            .HasForeignKey(a => a.TerritoryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Salesperson)
            .WithMany(s => s.TerritoryAssignments)
            .HasForeignKey(a => a.SalespersonId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.AssignedBy)
            .WithMany(u => u.TerritoryAssignmentsMade)
            .HasForeignKey(a => a.AssignedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class TerritoryGroupConfiguration : IEntityTypeConfiguration<TerritoryGroup>
{
    public void Configure(EntityTypeBuilder<TerritoryGroup> builder)
    {
        builder.ToTable("TerritoryGroup");

        builder.HasKey(g => g.Id);

        builder.Property(g => g.Name).IsRequired();
        builder.HasIndex(g => g.Name).IsUnique();

        builder.Property(g => g.IsActive).HasDefaultValue(true);
        builder.Property(g => g.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(g => g.UpdatedAt).IsRequired();
    }
}

public class TerritoryGroupMemberConfiguration : IEntityTypeConfiguration<TerritoryGroupMember>
{
    public void Configure(EntityTypeBuilder<TerritoryGroupMember> builder)
    {
        builder.ToTable("TerritoryGroupMember");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.EffectiveFrom).HasColumnType("date");
        builder.Property(m => m.EffectiveTo).HasColumnType("date");
        builder.Property(m => m.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(m => new { m.GroupId, m.TerritoryId, m.EffectiveFrom }).IsUnique();
        builder.HasIndex(m => new { m.TerritoryId, m.EffectiveTo });
        builder.HasIndex(m => new { m.GroupId, m.EffectiveTo });

        builder.HasOne(m => m.Group)
            .WithMany(g => g.Members)
            .HasForeignKey(m => m.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Territory)
            .WithMany(t => t.GroupMemberships)
            .HasForeignKey(m => m.TerritoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class HospitalTerritoryChangeConfiguration : IEntityTypeConfiguration<HospitalTerritoryChange>
{
    public void Configure(EntityTypeBuilder<HospitalTerritoryChange> builder)
    {
        builder.ToTable("HospitalTerritoryChange");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.ChangedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasIndex(c => new { c.HospitalId, c.ChangedAt });
        builder.HasIndex(c => new { c.RegistryId, c.ChangedAt });
    }
}
