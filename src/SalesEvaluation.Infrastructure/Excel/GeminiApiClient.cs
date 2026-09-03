namespace SalesEvaluation.Infrastructure.Excel;

using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

/// <summary>
/// Plain REST client for Google Gemini API — ports backend/src/services/gemini.service.ts.
/// No SDK dependency: one endpoint, one JSON shape, minimal footprint.
/// </summary>
public class GeminiApiClient
{
    private const string ApiBase = "https://generativelanguage.googleapis.com/v1beta/models";
    private const string DefaultModel = "gemini-1.5-flash";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GeminiApiClient> _logger;

    public GeminiApiClient(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<GeminiApiClient> logger)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public record GeminiCallResult(string ContentTh, string Model);

    public async Task<GeminiCallResult> CallGeminiAsync(string prompt, CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("GEMINI_API_KEY ไม่ได้ตั้งค่าไว้");

        var model = _configuration["Gemini:Model"]?.Trim()
                    ?? DefaultModel;
        if (string.IsNullOrWhiteSpace(model)) model = DefaultModel;

        var url = $"{ApiBase}/{model}:generateContent?key={apiKey}";

        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            }
        };

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(Timeout);

        var client = _httpClientFactory.CreateClient("gemini");

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsJsonAsync(url, requestBody, cts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException($"Gemini API ไม่ตอบสนองภายใน {Timeout.TotalSeconds} วินาที");
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var snippet = errorBody.Length > 500 ? errorBody[..500] : errorBody;
            throw new HttpRequestException($"Gemini API ตอบกลับผิดพลาด ({(int)response.StatusCode}): {snippet}");
        }

        var data = await response.Content.ReadFromJsonAsync<GeminiGenerateContentResponse>(cancellationToken: cancellationToken)
                   ?? throw new InvalidOperationException("Gemini API ไม่ได้ส่งข้อความกลับมา");

        var text = data.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text?.Trim();
        if (string.IsNullOrEmpty(text))
            throw new InvalidOperationException("Gemini API ไม่ได้ส่งข้อความกลับมา");

        return new GeminiCallResult(text, model);
    }

    // JSON shape from Gemini's REST API
    private sealed class GeminiGenerateContentResponse
    {
        [JsonPropertyName("candidates")]
        public List<Candidate>? Candidates { get; init; }

        public sealed class Candidate
        {
            [JsonPropertyName("content")]
            public Content? Content { get; init; }
        }

        public sealed class Content
        {
            [JsonPropertyName("parts")]
            public List<Part>? Parts { get; init; }
        }

        public sealed class Part
        {
            [JsonPropertyName("text")]
            public string? Text { get; init; }
        }
    }
}
