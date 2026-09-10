import { request } from "@/lib/api-client";
import { ProductMasterItem } from "@/lib/types";

export function listProducts(token: string, signal?: AbortSignal) {
  return request<{ products: ProductMasterItem[] }>("/products", { method: "GET", signal }, token);
}

export interface UpdateProductInput {
  code?: string | null;
  displayName?: string | null;
  isActive?: boolean;
}

export function updateProduct(token: string, id: number, input: UpdateProductInput) {
  return request<{ product: ProductMasterItem }>(
    `/products/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function listProductTypes(token: string, signal?: AbortSignal) {
  return request<{ productTypes: { id: number; name: string }[] }>(
    "/product-types",
    { method: "GET", signal },
    token
  );
}
