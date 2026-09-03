namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Auth;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<ChangePasswordResponse> ChangePasswordAsync(int userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
    Task<GetMeResponse> GetMeAsync(int userId, CancellationToken cancellationToken = default);
}
