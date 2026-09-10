namespace SalesEvaluation.Application.Common.Exceptions;

public class ConflictException : Exception
{
    public string? Code { get; }

    public ConflictException(string message, string? code = null) : base(message)
    {
        Code = code;
    }
}
