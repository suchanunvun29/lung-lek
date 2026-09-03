import { request } from "@/lib/api-client";
import { ProductMasterItem } from "@/lib/types";

export function listProducts(token: string) {
  return request<{ products: ProductMasterItem[] }>("/products", { method: "GET" }, token);
}

export interface UpdateProductInput {
  code?: string | null;
  displayName?: string | null;
  isActive?: boolean;
}

export function updateProduct(token: string, id: string, input: UpdateProductInput) {
  return request<{ product: ProductMasterItem }>(
    `/products/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function listProductTypes(token: string) {
  return request<{ productTypes: { id: string; name: string }[] }>(
    "/product-types",
    { method: "GET" },
    token
  );
}
