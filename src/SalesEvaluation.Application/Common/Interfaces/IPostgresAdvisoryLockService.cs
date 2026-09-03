namespace SalesEvaluation.Application.Common.Interfaces;

public interface IPostgresAdvisoryLockService
{
    public const long DefaultImportAdvisoryLockKey = 872341987L;

    Task<bool> TryAcquireTransactionLockAsync(long lockKey = DefaultImportAdvisoryLockKey, CancellationToken cancellationToken = default);
}
