namespace SalesEvaluation.IntegrationTests;

using SalesEvaluation.Application.Common.Interfaces;
using Xunit;

public class PostgresAdvisoryLockServiceTests
{
    [Fact]
    public void DefaultImportAdvisoryLockKey_MustMatchLegacyConstant()
    {
        // Assert: 872341987 constant from backend/src/services/import.service.ts
        Assert.Equal(872341987L, IPostgresAdvisoryLockService.DefaultImportAdvisoryLockKey);
    }
}
