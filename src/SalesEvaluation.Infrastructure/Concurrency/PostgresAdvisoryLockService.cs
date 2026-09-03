namespace SalesEvaluation.Infrastructure.Concurrency;

using Microsoft.EntityFrameworkCore;
using SalesEvaluation.Application.Common.Interfaces;
using SalesEvaluation.Infrastructure.Persistence;

public class PostgresAdvisoryLockService : IPostgresAdvisoryLockService
{
    private readonly AppDbContext _dbContext;

    public PostgresAdvisoryLockService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> TryAcquireTransactionLockAsync(
        long lockKey = IPostgresAdvisoryLockService.DefaultImportAdvisoryLockKey,
        CancellationToken cancellationToken = default)
    {
        var result = await _dbContext.Database
            .SqlQueryRaw<bool>("SELECT pg_try_advisory_xact_lock({0}) AS \"Value\"", lockKey)
            .FirstOrDefaultAsync(cancellationToken);

        return result;
    }
}
