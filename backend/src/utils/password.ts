import crypto from "crypto";

const TEMP_PASSWORD_BYTES = 9;

export function generateTemporaryPassword(): string {
  return crypto.randomBytes(TEMP_PASSWORD_BYTES).toString("base64url");
}
