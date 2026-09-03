namespace SalesEvaluation.Application.Common.Interfaces;

/// <summary>
/// Abstraction over the Gemini REST API — injected into CoachingInsightService.
/// Implementation lives in SalesEvaluation.Infrastructure to keep HTTP concerns out of Application.
/// </summary>
public interface IGeminiService
{
    Task<GeminiResult> CallAsync(string prompt, CancellationToken cancellationToken = default);
}

public record GeminiResult(string ContentTh, string Model);
