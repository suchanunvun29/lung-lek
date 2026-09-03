namespace SalesEvaluation.Domain.Tests;

using SalesEvaluation.Domain.Import;
using Xunit;

public class RowKeyGeneratorTests
{
    [Theory]
    [InlineData("INV-001", "Product A", "LOT-123", 1, "INV-001|Product A|LOT-123|1")]
    [InlineData("INV-002", "Product B", "LOT-456", 3, "INV-002|Product B|LOT-456|3")]
    [InlineData("SAL-999", "Special Product", "BATCH-001", 10, "SAL-999|Special Product|BATCH-001|10")]
    public void Generate_CreatesCorrectRowKey(string invoiceNo, string productName, string lot, int occurrenceIndex, string expected)
    {
        var result = RowKeyGenerator.Generate(invoiceNo, productName, lot, occurrenceIndex);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Generate_ThrowsOnEmptyInvoiceNo()
    {
        Assert.Throws<ArgumentException>(() => RowKeyGenerator.Generate("", "Product", "LOT", 1));
    }

    [Fact]
    public void Generate_ThrowsOnEmptyProductName()
    {
        Assert.Throws<ArgumentException>(() => RowKeyGenerator.Generate("INV", "", "LOT", 1));
    }

    [Fact]
    public void Generate_ThrowsOnEmptyLot()
    {
        Assert.Throws<ArgumentException>(() => RowKeyGenerator.Generate("INV", "Product", "", 1));
    }

    [Fact]
    public void Generate_ThrowsOnZeroOccurrenceIndex()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => RowKeyGenerator.Generate("INV", "Product", "LOT", 0));
    }

    [Fact]
    public void Generate_ThrowsOnNegativeOccurrenceIndex()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => RowKeyGenerator.Generate("INV", "Product", "LOT", -1));
    }

    [Theory]
    [InlineData("INV-001|Product A|LOT-123|1", "INV-001", "Product A", "LOT-123", 1)]
    [InlineData("INV-002|Product B|LOT-456|3", "INV-002", "Product B", "LOT-456", 3)]
    [InlineData("SAL-999|Special Product|BATCH-001|10", "SAL-999", "Special Product", "BATCH-001", 10)]
    public void TryParse_ParsesValidRowKey(string rowKey, string expectedInvoice, string expectedProduct, string expectedLot, int expectedIndex)
    {
        var success = RowKeyGenerator.TryParse(rowKey, out var invoiceNo, out var productName, out var lot, out var occurrenceIndex);

        Assert.True(success);
        Assert.Equal(expectedInvoice, invoiceNo);
        Assert.Equal(expectedProduct, productName);
        Assert.Equal(expectedLot, lot);
        Assert.Equal(expectedIndex, occurrenceIndex);
    }

    [Theory]
    [InlineData("")]
    [InlineData("INV-001|Product A|LOT-123")]
    [InlineData("INV-001|Product A|LOT-123|abc")]
    [InlineData("INV-001|Product A|LOT-123|1|extra")]
    public void TryParse_ReturnsFalseForInvalidRowKey(string rowKey)
    {
        var success = RowKeyGenerator.TryParse(rowKey, out _, out _, out _, out _);
        Assert.False(success);
    }
}