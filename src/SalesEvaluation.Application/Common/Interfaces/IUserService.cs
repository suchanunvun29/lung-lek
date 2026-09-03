namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Users;

public interface IUserService
{
    Task<UsersResponse> ListUsersAsync(CancellationToken cancellationToken = default);
    Task<CreateUserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateUserAsync(string id, UpdateUserRequest request, string currentUserId, CancellationToken cancellationToken = default);
    Task<ResetPasswordResponse> ResetPasswordAsync(string id, ResetPasswordRequest request, CancellationToken cancellationToken = default);
}
