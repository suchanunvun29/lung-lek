import { request } from "@/lib/api-client";
import { AppUser, UserRole } from "@/lib/types";

export function listUsers(token: string) {
  return request<{ users: AppUser[] }>("/users", { method: "GET" }, token);
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
  salespersonId?: string | null;
}

export function updateUser(token: string, id: string, input: UpdateUserInput) {
  return request<{ user: AppUser }>(
    `/users/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function resetUserPassword(token: string, id: string) {
  return request<{ message: string; temporaryPassword: string }>(
    `/users/${id}/reset-password`,
    { method: "POST", body: JSON.stringify({}) },
    token
  );
}
