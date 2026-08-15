import { listProductTypes } from "./api";
import { EntitySummary } from "./types";

/** GET /product-types now exists (masterData.controller.ts#listProductTypes) — no more sampling. */
export async function fetchKnownProductTypes(token: string): Promise<EntitySummary[]> {
  const data = await listProductTypes(token);
  return data.productTypes
    .map((pt) => ({ id: pt.id, displayName: pt.name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "th"));
}
