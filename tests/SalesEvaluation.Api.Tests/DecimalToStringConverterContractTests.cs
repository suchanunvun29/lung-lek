namespace SalesEvaluation.Api.Tests;

using System.Text.Json;
using SalesEvaluation.Api.Converters;
using Xunit;

/// <summary>
/// T-UX-023 — pins the DecimalToStringConverter read contract:
/// - non-nullable decimal accepts JSON numbers and numeric strings (invariant),
///   and an empty/whitespace/non-numeric string is a hard error (never a silent 0);
/// - nullable decimal? maps empty string to null (documented: empty = not provided)
///   and still rejects non-numeric strings.
/// </summary>
public class DecimalToStringConverterContractTests
{
    private sealed class Payload
    {
        public decimal Value { get; set; }
        public decimal? NullableValue { get; set; }
    }

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new DecimalToStringConverter(), new NullableDecimalToStringConverter() }
    };

    [Theory]
    [InlineData("\"1234.56\"", 1234.56)]
    [InlineData("\"0\"", 0)]
    [InlineData("\"-5.25\"", -5.25)]
    [InlineData("42", 42)]
    public void NonNullableDecimal_AcceptsNumbersAndNumericStrings(string json, double expected)
    {
        var payload = JsonSerializer.Deserialize<Payload>($"{{ \"value\": {json} }}", Options);

        Assert.Equal((decimal)expected, payload!.Value);
    }

    [Theory]
    [InlineData("\"\"")]
    [InlineData("\"   \"")]
    [InlineData("\"abc\"")]
    public void NonNullableDecimal_RejectsEmptyAndNonNumericStrings(string json)
    {
        Assert.ThrowsAny<JsonException>(() => JsonSerializer.Deserialize<Payload>($"{{ \"value\": {json} }}", Options));
    }

    [Fact]
    public void NullableDecimal_EmptyStringMapsToNull()
    {
        var payload = JsonSerializer.Deserialize<Payload>("{ \"nullableValue\": \"\" }", Options);

        Assert.Null(payload!.NullableValue);
    }

    [Theory]
    [InlineData("\"1.5\"", 1.5)]
    [InlineData("7", 7)]
    public void NullableDecimal_AcceptsNumbersAndNumericStrings(string json, double expected)
    {
        var payload = JsonSerializer.Deserialize<Payload>($"{{ \"nullableValue\": {json} }}", Options);

        Assert.Equal((decimal)expected, payload!.NullableValue);
    }

    [Theory]
    [InlineData("\"abc\"")]
    [InlineData("\"12x\"")]
    public void NullableDecimal_RejectsNonNumericStrings(string json)
    {
        Assert.ThrowsAny<JsonException>(() => JsonSerializer.Deserialize<Payload>($"{{ \"nullableValue\": {json} }}", Options));
    }
}
