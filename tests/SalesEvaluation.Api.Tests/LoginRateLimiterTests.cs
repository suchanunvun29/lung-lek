namespace SalesEvaluation.Api.Tests;

using SalesEvaluation.Api.Auth;
using Xunit;

/// <summary>
/// T-UX-024 — pins the in-memory sliding-window login rate limiter:
/// normal typos (1-2 failures) never block, threshold blocks, the block
/// is scoped per email+IP, a successful login resets the counter, and
/// the block recovers after the window passes.
/// </summary>
public class LoginRateLimiterTests
{
    [Fact]
    public void FewFailures_DoNotBlock()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMinutes(5));

        limiter.RecordFailure("a@x.com", "1.2.3.4");
        limiter.RecordFailure("a@x.com", "1.2.3.4");

        Assert.False(limiter.IsBlocked("a@x.com", "1.2.3.4"));
    }

    [Fact]
    public void AtThreshold_IsBlocked()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMinutes(5));

        for (var i = 0; i < 5; i++)
        {
            limiter.RecordFailure("a@x.com", "1.2.3.4");
        }

        Assert.True(limiter.IsBlocked("a@x.com", "1.2.3.4"));
    }

    [Fact]
    public void Block_IsScopedPerEmail()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMinutes(5));

        for (var i = 0; i < 5; i++)
        {
            limiter.RecordFailure("a@x.com", "1.2.3.4");
        }

        Assert.False(limiter.IsBlocked("b@x.com", "1.2.3.4"));
    }

    [Fact]
    public void Block_IsScopedPerIp()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMinutes(5));

        for (var i = 0; i < 5; i++)
        {
            limiter.RecordFailure("a@x.com", "1.2.3.4");
        }

        Assert.False(limiter.IsBlocked("a@x.com", "5.6.7.8"));
    }

    [Fact]
    public void EmailIsCaseAndWhitespaceInsensitive()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMinutes(5));

        for (var i = 0; i < 5; i++)
        {
            limiter.RecordFailure("  A@X.com  ", "1.2.3.4");
        }

        Assert.True(limiter.IsBlocked("a@x.com", "1.2.3.4"));
    }

    [Fact]
    public void SuccessfulLogin_ResetsFailureCount()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMinutes(5));

        for (var i = 0; i < 4; i++)
        {
            limiter.RecordFailure("a@x.com", "1.2.3.4");
        }

        limiter.RecordSuccess("a@x.com", "1.2.3.4");

        for (var i = 0; i < 4; i++)
        {
            limiter.RecordFailure("a@x.com", "1.2.3.4");
        }

        Assert.False(limiter.IsBlocked("a@x.com", "1.2.3.4"));
    }

    [Fact]
    public void Block_RecoveredAfterWindowPasses()
    {
        var limiter = new LoginRateLimiter(maxFailedAttempts: 5, window: TimeSpan.FromMilliseconds(120));

        for (var i = 0; i < 5; i++)
        {
            limiter.RecordFailure("a@x.com", "1.2.3.4");
        }

        Assert.True(limiter.IsBlocked("a@x.com", "1.2.3.4"));

        Thread.Sleep(200);

        Assert.False(limiter.IsBlocked("a@x.com", "1.2.3.4"));
    }
}
