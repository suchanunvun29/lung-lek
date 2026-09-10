namespace SalesEvaluation.Api.Converters;

using System;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

public class DecimalToStringConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetDecimal();
        }
        if (reader.TokenType == JsonTokenType.String)
        {
            var stringVal = reader.GetString();
            // T-UX-023 contract: an empty string must never silently become 0 —
            // send a number, or use a nullable decimal field for "not provided".
            if (string.IsNullOrWhiteSpace(stringVal))
            {
                throw new JsonException("Empty string is not a valid decimal value.");
            }
            if (decimal.TryParse(stringVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
            {
                return result;
            }
        }
        throw new JsonException($"Cannot convert token {reader.TokenType} to decimal.");
    }

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString(CultureInfo.InvariantCulture));
    }
}

public class NullableDecimalToStringConverter : JsonConverter<decimal?>
{
    public override decimal? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }
        if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetDecimal();
        }
        if (reader.TokenType == JsonTokenType.String)
        {
            var stringVal = reader.GetString();
            if (string.IsNullOrWhiteSpace(stringVal))
            {
                return null;
            }
            if (decimal.TryParse(stringVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
            {
                return result;
            }
        }
        throw new JsonException($"Cannot convert token {reader.TokenType} to nullable decimal.");
    }

    public override void Write(Utf8JsonWriter writer, decimal? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
        {
            writer.WriteStringValue(value.Value.ToString(CultureInfo.InvariantCulture));
        }
        else
        {
            writer.WriteNullValue();
        }
    }
}
