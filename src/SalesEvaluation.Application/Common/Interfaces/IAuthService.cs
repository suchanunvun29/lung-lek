namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Auth;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<ChangePasswordResponse> ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
    Task<GetMeResponse> GetMeAsync(string userId, CancellationToken cancellationToken = default);
}
