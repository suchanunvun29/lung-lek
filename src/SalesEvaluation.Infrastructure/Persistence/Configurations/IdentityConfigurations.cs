namespace SalesEvaluation.Infrastructure.Persistence.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SalesEvaluation.Domain.Entities;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("User");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).ValueGeneratedNever();

        builder.Property(u => u.Email).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash).IsRequired();
        builder.Property(u => u.DisplayName).IsRequired();
        builder.Property(u => u.Role).IsRequired();
        builder.Property(u => u.IsActive).HasDefaultValue(true);
        builder.Property(u => u.MustChangePassword).HasDefaultValue(true);
        builder.Property(u => u.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(u => u.UpdatedAt).IsRequired();

        builder.HasOne(u => u.Salesperson)
            .WithOne(s => s.User)
            .HasForeignKey<Salesperson>(s => s.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SalespersonConfiguration : IEntityTypeConfiguration<Salesperson>
{
    public void Configure(EntityTypeBuilder<Salesperson> builder)
    {
        builder.ToTable("Salesperson");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.NameInFile).IsRequired();
        builder.HasIndex(s => s.NameInFile).IsUnique();

        builder.Property(s => s.DisplayName).IsRequired();
        builder.Property(s => s.IsActive).HasDefaultValue(true);
        builder.Property(s => s.ExcludedFromTerritoryTotals).HasDefaultValue(false);
        builder.Property(s => s.EmploymentEndedAt).HasColumnType("date");
        builder.Property(s => s.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(s => s.UpdatedAt).IsRequired();

        builder.HasIndex(s => s.UserId).IsUnique();
    }
}
