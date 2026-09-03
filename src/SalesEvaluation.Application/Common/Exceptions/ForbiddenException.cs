namespace SalesEvaluation.Application.Common.Exceptions;

public class ForbiddenException : Exception
{
    public string? Code { get; }

    public ForbiddenException(string message, string? code = null) : base(message)
    {
        Code = code;
    }
}
