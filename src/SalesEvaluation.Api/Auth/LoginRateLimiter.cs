namespace SalesEvaluation.Api.Auth;

using System.Collections.Concurrent;

public interface ILoginRateLimiter
{
    bool IsBlocked(string email, string? ipAddress);

    void RecordFailure(string email, string? ipAddress);

    void RecordSuccess(string email, string? ipAddress);
}

/// <summary>
/// T-UX-024 — soft in-memory sliding-window login rate limiter, keyed per
/// email+IP so an office sharing one IP is never locked out by one account's
/// typos (threshold 5 failures within 5 minutes by default). A successful
/// login resets the counter; the block lifts itself once the failed attempts
/// age out of the window.
/// </summary>
public sealed class LoginRateLimiter : ILoginRateLimiter
{
    private readonly int _maxFailedAttempts;
    private readonly TimeSpan _window;
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _failures = new();

    public LoginRateLimiter(int maxFailedAttempts = 5, TimeSpan? window = null)
    {
        _maxFailedAttempts = maxFailedAttempts;
        _window = window ?? TimeSpan.FromMinutes(5);
    }

    public bool IsBlocked(string email, string? ipAddress)
    {
        var queue = GetQueue(Key(email, ipAddress));
        lock (queue)
        {
            Prune(queue);
            return queue.Count >= _maxFailedAttempts;
        }
    }

    public void RecordFailure(string email, string? ipAddress)
    {
        var queue = GetQueue(Key(email, ipAddress));
        lock (queue)
        {
            Prune(queue);
            queue.Enqueue(DateTimeOffset.UtcNow);
        }
    }

    public void RecordSuccess(string email, string? ipAddress)
    {
        _failures.TryRemove(Key(email, ipAddress), out _);
    }

    private static string Key(string email, string? ipAddress) =>
        $"{email.Trim().ToLowerInvariant()}|{ipAddress ?? "unknown"}";

    private Queue<DateTimeOffset> GetQueue(string key) =>
        _failures.GetOrAdd(key, _ => new Queue<DateTimeOffset>());

    private void Prune(Queue<DateTimeOffset> queue)
    {
        var cutoff = DateTimeOffset.UtcNow - _window;
        while (queue.Count > 0 && queue.Peek() < cutoff)
        {
            queue.Dequeue();
        }
    }
}
