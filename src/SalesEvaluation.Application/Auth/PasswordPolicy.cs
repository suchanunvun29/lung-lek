namespace SalesEvaluation.Application.Auth;

/// <summary>
/// Single source of the password policy the UI communicates (T-UX-024) —
/// the backend is the authoritative layer, so every path that sets a
/// password (change-password, user creation, temporary/reset passwords)
/// must enforce the same minimum length with the same Thai message.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const string NewPasswordTooShortMessage = "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร";
    public const string TemporaryPasswordTooShortMessage = "รหัสผ่านชั่วคราวต้องมีอย่างน้อย 8 ตัวอักษร";
}
