namespace SalesEvaluation.Api.Middleware;

using System.Net;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using SalesEvaluation.Application.Common.Exceptions;

public class GlobalExceptionHandlerMiddleware
{
    // Express returns raw UTF-8 (Thai messages are not \u-escaped) — match that contract.
    private static readonly JsonSerializerOptions ResponseJsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;

    public GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while processing request {Path}", context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        switch (exception)
        {
            case ValidationException validationEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                var valResponse = validationEx.Details != null
                    ? (object)new { error = validationEx.Message, details = validationEx.Details }
                    : new { error = validationEx.Message };
                await context.Response.WriteAsync(JsonSerializer.Serialize(valResponse, ResponseJsonOptions));
                break;

            case UnauthorizedException unauthEx:
                context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = unauthEx.Message }, ResponseJsonOptions));
                break;

            case ForbiddenException forbiddenEx:
                context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                var forbidResponse = forbiddenEx.Code != null
                    ? (object)new { error = forbiddenEx.Message, code = forbiddenEx.Code }
                    : new { error = forbiddenEx.Message };
                await context.Response.WriteAsync(JsonSerializer.Serialize(forbidResponse, ResponseJsonOptions));
                break;

            case NotFoundException notFoundEx:
                context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = notFoundEx.Message }, ResponseJsonOptions));
                break;

            case ConflictException conflictEx:
                context.Response.StatusCode = (int)HttpStatusCode.Conflict;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = conflictEx.Message }, ResponseJsonOptions));
                break;

            default:
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = "Internal server error" }, ResponseJsonOptions));
                break;
        }
    }
}
