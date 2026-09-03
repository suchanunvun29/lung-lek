namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Users;

public interface IUserService
{
    Task<UsersResponse> ListUsersAsync(CancellationToken cancellationToken = default);
    Task<CreateUserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateUserAsync(int id, UpdateUserRequest request, int currentUserId, CancellationToken cancellationToken = default);
    Task<ResetPasswordResponse> ResetPasswordAsync(int id, ResetPasswordRequest request, CancellationToken cancellationToken = default);
}
