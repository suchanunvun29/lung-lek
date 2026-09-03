namespace SalesEvaluation.Domain.MasterData;

using System.Text.RegularExpressions;

public static class NameNormalizer
{
    private static readonly Regex ThaiOrDigitRegex = new(@"[\u0E00-\u0E7F0-9]", RegexOptions.Compiled);
    private static readonly Regex LatinOrDigitRegex = new(@"[A-Za-z0-9]", RegexOptions.Compiled);
    private static readonly Regex LetterWordRegex = new(@"[A-Za-z]+", RegexOptions.Compiled);
    private static readonly Regex SharedSalesmanDelimiterRegex = new(@"\s*(?:/|&|\+|,|และ)\s*", RegexOptions.Compiled);

    private static readonly string[] ThaiHospitalPrefixes =
    [
        "โรงพยาบาลส่งเสริมสุขภาพตำบล",
        "รพสต",
        "โรงพยาบาล",
        "รพ"
    ];

    private static readonly HashSet<string> PersonTitleWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "MR", "MRS", "MISS", "MS", "DR", "KHUN", "K"
    };

    /// <summary>
    /// Keeps only Thai characters and digits, strips all prefixes from the head until none match.
    /// </summary>
    public static string ThaiCore(string input)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        var matches = ThaiOrDigitRegex.Matches(input);
        var result = string.Concat(matches.Select(m => m.Value));

        var strippedSomething = true;
        while (strippedSomething)
        {
            strippedSomething = false;
            foreach (var prefix in ThaiHospitalPrefixes)
            {
                if (result.StartsWith(prefix, StringComparison.Ordinal))
                {
                    result = result[prefix.Length..];
                    strippedSomething = true;
                }
            }
        }

        return result;
    }

    /// <summary>
    /// Keeps only A-Z0-9 and converts to uppercase.
    /// </summary>
    public static string LatinCore(string input)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        var matches = LatinOrDigitRegex.Matches(input);
        return string.Concat(matches.Select(m => m.Value)).ToUpperInvariant();
    }

    /// <summary>
    /// Strips person title words, keeps only English letters, and concatenates uppercase.
    /// </summary>
    public static string PersonCore(string input)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        var matches = LetterWordRegex.Matches(input);
        if (matches.Count == 0)
            return string.Empty;

        var startIndex = PersonTitleWords.Contains(matches[0].Value) ? 1 : 0;
        return string.Concat(matches.Skip(startIndex).Select(m => m.Value.ToUpperInvariant()));
    }

    /// <summary>
    /// Splits raw salesman string containing delimiters into individual trimmed non-empty names.
    /// </summary>
    public static string[] SplitSharedSalesmanNames(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return [];

        return SharedSalesmanDelimiterRegex.Split(raw)
            .Select(name => name.Trim())
            .Where(name => name.Length > 0)
            .ToArray();
    }

    /// <summary>
    /// Normalizes shared salesman names by joining individual personCore strings with '/'.
    /// </summary>
    public static string NormalizeSharedSalesmanRaw(IEnumerable<string> rawNames)
    {
        return string.Join("/", rawNames.Select(PersonCore));
    }
}
