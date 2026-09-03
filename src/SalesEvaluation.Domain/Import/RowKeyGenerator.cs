namespace SalesEvaluation.Domain.Import;

public static class RowKeyGenerator
{
    public static string Generate(string invoiceNo, string productName, string lot, int occurrenceIndex)
    {
        if (string.IsNullOrWhiteSpace(invoiceNo))
            throw new ArgumentException("InvoiceNo cannot be empty", nameof(invoiceNo));
        if (string.IsNullOrWhiteSpace(productName))
            throw new ArgumentException("ProductName cannot be empty", nameof(productName));
        if (string.IsNullOrWhiteSpace(lot))
            throw new ArgumentException("Lot cannot be empty", nameof(lot));
        if (occurrenceIndex < 1)
            throw new ArgumentOutOfRangeException(nameof(occurrenceIndex), "OccurrenceIndex must be >= 1");

        return $"{invoiceNo}|{productName}|{lot}|{occurrenceIndex}";
    }

    public static bool TryParse(string rowKey, out string invoiceNo, out string productName, out string lot, out int occurrenceIndex)
    {
        invoiceNo = string.Empty;
        productName = string.Empty;
        lot = string.Empty;
        occurrenceIndex = 0;

        if (string.IsNullOrWhiteSpace(rowKey))
            return false;

        var parts = rowKey.Split('|');
        if (parts.Length != 4)
            return false;

        invoiceNo = parts[0];
        productName = parts[1];
        lot = parts[2];

        if (!int.TryParse(parts[3], out occurrenceIndex))
            return false;

        return true;
    }
}