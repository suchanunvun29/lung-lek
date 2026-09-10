const DEFAULT_DOCS_URL = "http://localhost:5173";

export const DOCS_BASE_URL =
  process.env.NEXT_PUBLIC_DOCS_URL?.trim().replace(/\/+$/, "") || DEFAULT_DOCS_URL;

export function docsUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${DOCS_BASE_URL}${normalizedPath}`;
}

