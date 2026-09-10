"use client";

import { useState } from "react";
import {
  HospitalTable,
  SalespersonTable,
  listHospitalsPage,
  listSalespeople,
  updateHospital,
  updateSalesperson,
} from "@/features/master-data";
import { ProductMasterTable, listProducts, updateProduct } from "@/features/products";
import { listUsers } from "@/features/users";
import { getErrorMessage } from "@/lib/api-client";
import { AppUser, Hospital, ProductMasterItem, Salesperson } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/components/shared/feedback/toast/ToastProvider";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/feedback/EmptyState";
import { SkeletonTable } from "@/components/shared/feedback/Skeleton";
import { useAbortableEffect } from "@/lib/useAbortableEffect";
import { useUrlState } from "@/lib/useUrlState";

type Tab = "salespeople" | "hospitals" | "products";

export default function MasterDataPage() {
  const { searchParams, setUrlState } = useUrlState();
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "hospitals" || tabParam === "products" ? tabParam : "salespeople";
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [products, setProducts] = useState<ProductMasterItem[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // T-UX-025 — the hospitals tab pages server-side, so its fetch keeps its own
  // state instead of riding the all-tabs Promise.all.
  const HOSPITALS_PAGE_SIZE = 25;
  const [hospitalsPage, setHospitalsPage] = useState(1);
  const [hospitalsTotal, setHospitalsTotal] = useState(0);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [hospitalsSearch, setHospitalsSearch] = useState("");

  function setTab(nextTab: Tab) {
    setUrlState({ tab: nextTab === "salespeople" ? null : nextTab });
  }

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setLoading(true);
      try {
        const [salespeopleData, productsData] = await Promise.all([
          listSalespeople(token, signal),
          listProducts(token, signal),
        ]);
        if (signal.aborted) return;
        setSalespeople(salespeopleData.salespeople);
        setProducts(productsData.products);
        if (canEdit) {
          const usersData = await listUsers(token, signal);
          if (signal.aborted) return;
          setUsers(usersData.users);
        }
        setLoadError(null);
      } catch (err) {
        if (!signal.aborted) {
          setLoadError(getErrorMessage(err, "โหลดข้อมูล master data ไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [token, canEdit, reloadNonce]
  );

  useAbortableEffect(
    async (signal) => {
      if (!token) return;
      setHospitalsLoading(true);
      try {
        const data = await listHospitalsPage(
          token,
          { page: hospitalsPage, pageSize: HOSPITALS_PAGE_SIZE, q: hospitalsSearch || undefined },
          signal
        );
        if (signal.aborted) return;
        setHospitals(data.items);
        setHospitalsTotal(data.total);
      } catch (err) {
        if (!signal.aborted) {
          setLoadError(getErrorMessage(err, "โหลดข้อมูลโรงพยาบาลไม่สำเร็จ"));
        }
      } finally {
        if (!signal.aborted) {
          setHospitalsLoading(false);
        }
      }
    },
    [token, reloadNonce, hospitalsPage, hospitalsSearch]
  );

  async function handleHospitalToggle(hospital: Hospital, isPreExistingCustomer: boolean) {
    if (!token) return;
    setActionError(null);
    try {
      const data = await updateHospital(token, hospital.id, isPreExistingCustomer);
      setHospitals((prev) => prev.map((h) => (h.id === hospital.id ? data.hospital : h)));
      // T-UX-012 — inline save สำเร็จต้องไม่เงียบ
      toast.success(`${hospital.displayName}: ${isPreExistingCustomer ? "ตั้งเป็นลูกค้าเดิมแล้ว" : "ยกเลิกสถานะลูกค้าเดิมแล้ว"}`);
    } catch (err) {
      setActionError(getErrorMessage(err, "แก้ไขข้อมูลโรงพยาบาลไม่สำเร็จ"));
    }
  }

  async function handleSalespersonLink(salesperson: Salesperson, userId: number | null) {
    if (!token) return;
    setActionError(null);
    try {
      const data = await updateSalesperson(token, salesperson.id, { userId });
      setSalespeople((prev) => prev.map((sp) => (sp.id === salesperson.id ? data.salesperson : sp)));
      setReloadNonce((n) => n + 1);
      // T-UX-012 — inline save สำเร็จต้องไม่เงียบ (ผูกและยกเลิกผูกบัญชีต่างข้อความ)
      toast.success(
        userId === null
          ? `ยกเลิกการผูกบัญชีของ ${salesperson.displayName} เรียบร้อยแล้ว`
          : `ผูกบัญชีของ ${salesperson.displayName} เรียบร้อยแล้ว`
      );
    } catch (err) {
      setActionError(getErrorMessage(err, "ผูกบัญชีผู้ใช้ไม่สำเร็จ"));
    }
  }

  async function handleEmploymentDate(salesperson: Salesperson, employmentEndedAt: string | null) {
    if (!token) return;
    setActionError(null);
    try {
      const data = await updateSalesperson(token, salesperson.id, { employmentEndedAt });
      setSalespeople((prev) => prev.map((sp) => (sp.id === salesperson.id ? data.salesperson : sp)));
      // T-UX-012 — inline save สำเร็จต้องไม่เงียบ
      toast.success(
        employmentEndedAt
          ? `บันทึกวันที่พ้นสภาพของ ${salesperson.displayName} เรียบร้อยแล้ว`
          : `ลบวันที่พ้นสภาพของ ${salesperson.displayName} เรียบร้อยแล้ว`
      );
    } catch (err) {
      setActionError(getErrorMessage(err, "บันทึกวันที่พ้นสภาพไม่สำเร็จ"));
    }
  }

  async function handleProductSave(
    product: ProductMasterItem,
    input: { code: string | null; displayName: string | null; isActive: boolean }
  ) {
    if (!token) return;
    setActionError(null);
    try {
      const data = await updateProduct(token, product.id, input);
      setProducts((items) => items.map((item) => (item.id === product.id ? data.product : item)));
      // T-UX-012 — inline save สำเร็จต้องไม่เงียบ
      toast.success(`บันทึกข้อมูลสินค้า "${data.product.displayName ?? data.product.code}" เรียบร้อยแล้ว`);
    } catch (saveError) {
      setActionError(getErrorMessage(saveError, "บันทึกสินค้าไม่สำเร็จ"));
    }
  }

  return (
    <PageContainer width="standard">
      <PageHeader
        title="ข้อมูลหลัก"
        description="จัดการข้อมูลพนักงานขาย โรงพยาบาล และทะเบียนสินค้า"
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-text-muted">
          คุณสามารถดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ
        </p>
      )}

      <Tabs value={tab} onValueChange={(val) => setTab(val as Tab)}>
        <div className="overflow-x-auto pb-1 mb-4">
          <TabsList className="min-w-max">
            <TabsTrigger value="salespeople">พนักงานขาย</TabsTrigger>
            <TabsTrigger value="hospitals">โรงพยาบาล</TabsTrigger>
            <TabsTrigger value="products">สินค้า</TabsTrigger>
          </TabsList>
        </div>

        {loadError && (
          <EmptyState
            variant="error"
            title="โหลดข้อมูลหลักไม่สำเร็จ"
            description={loadError}
            onRetry={() => setReloadNonce((n) => n + 1)}
            isRetrying={loading}
          />
        )}
        {actionError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-status-danger">
            {actionError}
          </div>
        )}

        {loading && <SkeletonTable rows={8} columns={5} />}

        {!loading && !loadError && (
          <>
            <TabsContent value="salespeople">
              <SalespersonTable
                salespeople={salespeople}
                linkableUsers={users}
                canEdit={canEdit}
                onLink={handleSalespersonLink}
                onEmploymentDate={handleEmploymentDate}
              />
            </TabsContent>

            <TabsContent value="hospitals">
              <HospitalTable
                hospitals={hospitals}
                canEdit={canEdit}
                onToggle={handleHospitalToggle}
                loading={hospitalsLoading}
                page={hospitalsPage}
                pageSize={HOSPITALS_PAGE_SIZE}
                total={hospitalsTotal}
                onPageChange={setHospitalsPage}
                search={hospitalsSearch}
                onSearchChange={(value) => {
                  setHospitalsSearch(value);
                  setHospitalsPage(1);
                }}
              />
            </TabsContent>

            <TabsContent value="products">
              <ProductMasterTable
                products={products}
                canEdit={canEdit}
                onSave={handleProductSave}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </PageContainer>
  );
}
