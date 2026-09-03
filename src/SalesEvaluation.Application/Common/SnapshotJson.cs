namespace SalesEvaluation.Application.Common;

using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

/// <summary>
/// Serializer for revision snapshots (TargetRevision.before/after, ScoringWeightRevision.before/after).
/// Mirrors JSON.stringify of a plain JS object: camelCase keys, numbers stay numbers, enums as
/// their SCREAMING names — the same shape the TS services write into the jsonb columns.
/// </summary>
public static class SnapshotJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter() }
    };

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    public static T? Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Options);
}
