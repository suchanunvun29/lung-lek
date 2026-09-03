namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.MasterData;
using Xunit;

public class NameNormalizerTests
{
    [Theory]
    [InlineData("โรงพยาบาลศิริราช", "ศิริราช")]
    [InlineData("รพ.จุฬาลงกรณ์", "จุฬาลงกรณ์")]
    [InlineData("รพสต.บ้านหนองหอย", "บ้านหนองหอย")]
    [InlineData("โรงพยาบาลส่งเสริมสุขภาพตำบลดอยสะเก็ด", "ดอยสะเก็ด")]
    [InlineData("Bangkok Hospital (สาขา 1)", "สาขา1")]
    public void ThaiCore_StripsPrefixesAndNonThaiDigits(string input, string expected)
    {
        var result = NameNormalizer.ThaiCore(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Bangkok Hospital 1", "BANGKOKHOSPITAL1")]
    [InlineData("รพ. BNH (Silom Branch)", "BNHSILOMBRANCH")]
    public void LatinCore_KeepsOnlyLatinAndDigitsUppercase(string input, string expected)
    {
        var result = NameNormalizer.LatinCore(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("MR. SOMCHAI PRASERT", "SOMCHAIPRASERT")]
    [InlineData("DR. SOMSRI", "SOMSRI")]
    [InlineData("KHUN ANAN", "ANAN")]
    [InlineData("K. CHAI", "CHAI")]
    [InlineData("MISS WANNA", "WANNA")]
    public void PersonCore_StripsTitleAndKeepsUppercaseWords(string input, string expected)
    {
        var result = NameNormalizer.PersonCore(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void SplitSharedSalesmanNames_SplitsOnDelimiters()
    {
        var raw = "MR. SOMCHAI / MRS. SOMSRI & DR. ANAN + K. CHAI, WANNA และ NOPPADON";
        var parts = NameNormalizer.SplitSharedSalesmanNames(raw);

        Assert.Equal(6, parts.Length);
        Assert.Equal("MR. SOMCHAI", parts[0]);
        Assert.Equal("MRS. SOMSRI", parts[1]);
        Assert.Equal("DR. ANAN", parts[2]);
        Assert.Equal("K. CHAI", parts[3]);
        Assert.Equal("WANNA", parts[4]);
        Assert.Equal("NOPPADON", parts[5]);
    }

    [Fact]
    public void NormalizeSharedSalesmanRaw_JoinsPersonCoresWithSlash()
    {
        var raw = "MR. SOMCHAI / MRS. SOMSRI";
        var parts = NameNormalizer.SplitSharedSalesmanNames(raw);
        var normalized = NameNormalizer.NormalizeSharedSalesmanRaw(parts);

        Assert.Equal("SOMCHAI/SOMSRI", normalized);
    }
}
