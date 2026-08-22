"use client";

import { useCallback, useEffect, useState } from "react";
import ProductMasterTable from "@/components/products/ProductMasterTable";
import { getErrorMessage, listProducts, updateProduct } from "@/lib/api";
import { ProductMasterItem } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

export default function ProductsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === "MANAGER";
  const [products, setProducts] = useState<ProductMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!token) return; setLoading(true); try { const data = await listProducts(token); setProducts(data.products); setError(null); } catch (loadError) { setError(getErrorMessage(loadError, "โหลดทะเบียนสินค้าไม่สำเร็จ")); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function handleSave(product: ProductMasterItem, input: { code: string | null; displayName: string | null; isActive: boolean }) { if (!token) return; setError(null); try { const data = await updateProduct(token, product.id, input); setProducts((items) => items.map((item) => item.id === product.id ? data.product : item)); } catch (saveError) { setError(getErrorMessage(saveError, "บันทึกสินค้าไม่สำเร็จ")); } }
  return <div className="mx-auto max-w-6xl p-4 sm:p-6"><h1 className="text-2xl font-semibold text-zinc-900">ทะเบียนสินค้า</h1><p className="mt-1 text-sm text-zinc-600">รายการที่สร้างจากประวัติการขายจะยังไม่มีรหัสสินค้า</p>{!canEdit && <p className="mt-1 text-sm text-zinc-600">คุณสามารถดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ</p>}{loading && <p className="mt-6 text-zinc-400">กำลังโหลด...</p>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}{!loading && <div className="mt-4"><ProductMasterTable products={products} canEdit={canEdit} onSave={handleSave} /></div>}</div>;
}
