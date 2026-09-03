namespace SalesEvaluation.Infrastructure.Authentication;

using Microsoft.AspNetCore.Http;
using SalesEvaluation.Application.Common.Interfaces;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public CurrentUser? User => _httpContextAccessor.HttpContext?.Items["CurrentUser"] as CurrentUser;
}
