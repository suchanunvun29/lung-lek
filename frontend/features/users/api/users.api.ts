import { request } from "@/lib/api-client";
import { AppUser, UserRole } from "@/lib/types";

export function listUsers(token: string, signal?: AbortSignal) {
  return request<{ users: AppUser[] }>("/users", { method: "GET", signal }, token);
}

/** T-UX-025 — server pagination; total counts after the server-side filters. */
export function listUsersPage(
  token: string,
  params: { page: number; pageSize: number; role?: string; unlinkedOnly?: boolean; q?: string },
  signal?: AbortSignal
) {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.role && params.role !== "ALL") search.set("role", params.role);
  if (params.unlinkedOnly) search.set("unlinkedOnly", "true");
  if (params.q && params.q.trim() !== "") search.set("q", params.q.trim());
  return request<{ items: AppUser[]; total: number; page: number; pageSize: number }>(
    `/users?${search.toString()}`,
    { method: "GET", signal },
    token
  );
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  role: UserRole;
  temporaryPassword?: string;
}

export function createUser(token: string, input: CreateUserInput) {
  return request<{ user: AppUser; temporaryPassword: string }>(
    "/users",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
  salespersonId?: number | null;
}

export function updateUser(token: string, id: number, input: UpdateUserInput) {
  return request<{ user: AppUser }>(
    `/users/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function resetUserPassword(token: string, id: number) {
  return request<{ message: string; temporaryPassword: string }>(
    `/users/${id}/reset-password`,
    { method: "POST", body: JSON.stringify({}) },
    token
  );
}
