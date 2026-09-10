/**
 * คู่มือถูกเสิร์ฟจาก origin เดียวกับแอปผ่าน reverse proxy ที่ /docs.
 * ใช้ path สัมพัทธ์เพื่อให้ใช้งานได้ทั้ง local และ production โดยไม่ต้อง
 * ฝังค่าโดเมนหรือ NEXT_PUBLIC_* environment variable ลงใน frontend build.
 */
export const DOCS_BASE_URL = "/docs";

export function docsUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${DOCS_BASE_URL}${normalizedPath}`;
}
