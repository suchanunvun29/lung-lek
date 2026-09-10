namespace SalesEvaluation.Application.Common.Interfaces;

using SalesEvaluation.Contracts.Users;

public interface IUserService
{
    Task<UsersResponse> ListUsersAsync(string? role = null, bool? unlinkedOnly = null, string? q = null, CancellationToken cancellationToken = default);
    /// <summary>T-UX-025 — paged variant; total counts after role/unlinkedOnly/q filters.</summary>
    Task<UsersPageResponse> ListUsersPageAsync(int page, int pageSize, string? role = null, bool? unlinkedOnly = null, string? q = null, CancellationToken cancellationToken = default);
    Task<CreateUserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserResponse> UpdateUserAsync(int id, UpdateUserRequest request, int currentUserId, CancellationToken cancellationToken = default);
    Task<ResetPasswordResponse> ResetPasswordAsync(int id, ResetPasswordRequest request, CancellationToken cancellationToken = default);
}
