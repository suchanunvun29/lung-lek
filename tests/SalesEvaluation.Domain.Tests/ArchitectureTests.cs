namespace SalesEvaluation.Domain.Tests;

using System.Reflection;
using SalesEvaluation.Domain.Common;
using Xunit;

public class ArchitectureTests
{
    [Fact]
    public void DomainAssembly_ShouldNotReferenceInfrastructureOrApplicationOrApi()
    {
        // Arrange
        var domainAssembly = typeof(IDomainEntity).Assembly;
        var referencedAssemblies = domainAssembly.GetReferencedAssemblies();

        // Assert: Domain must not depend on Infrastructure, Application, Api, or external persistence
        var forbiddenNames = new[]
        {
            "SalesEvaluation.Infrastructure",
            "SalesEvaluation.Application",
            "SalesEvaluation.Api",
            "Npgsql",
            "Npgsql.EntityFrameworkCore.PostgreSQL",
            "Microsoft.EntityFrameworkCore",
            "Microsoft.EntityFrameworkCore.Relational"
        };

        foreach (var forbidden in forbiddenNames)
        {
            Assert.DoesNotContain(referencedAssemblies, a => a.Name != null && a.Name.StartsWith(forbidden, StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void DomainAssembly_ShouldOnlyReferenceCoreBclLibraries()
    {
        var domainAssembly = typeof(IDomainEntity).Assembly;
        var referencedAssemblies = domainAssembly.GetReferencedAssemblies();

        // Ensure all references are System or Microsoft core runtime BCL assemblies
        foreach (var reference in referencedAssemblies)
        {
            var name = reference.Name ?? string.Empty;
            var isBcl = name.StartsWith("System", StringComparison.OrdinalIgnoreCase) ||
                        name.StartsWith("Microsoft.CSharp", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("netstandard", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("mscorlib", StringComparison.OrdinalIgnoreCase);

            Assert.True(isBcl, $"SalesEvaluation.Domain should not reference external package: {name}");
        }
    }
}
