import { request } from "@/lib/api-client";
import { AuthUser } from "@/lib/types";

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  return request<{ message: string }>(
    "/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    token
  );
}

export function getMe(token: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>("/auth/me", {}, token);
}
