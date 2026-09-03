namespace SalesEvaluation.Application.Common.Exceptions;

public class ValidationException : Exception
{
    public object? Details { get; }

    public ValidationException(string message, object? details = null) : base(message)
    {
        Details = details;
    }
}
