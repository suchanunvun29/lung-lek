namespace SalesEvaluation.Infrastructure.Excel;

using SalesEvaluation.Application.Common.Interfaces;

/// <summary>
/// Bridges GeminiApiClient (Infrastructure) with IGeminiService (Application interface).
/// </summary>
public class GeminiService : IGeminiService
{
    private readonly GeminiApiClient _client;

    public GeminiService(GeminiApiClient client)
    {
        _client = client;
    }

    public async Task<GeminiResult> CallAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var result = await _client.CallGeminiAsync(prompt, cancellationToken);
        return new GeminiResult(result.ContentTh, result.Model);
    }
}
