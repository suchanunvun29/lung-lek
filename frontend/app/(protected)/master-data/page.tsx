"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HospitalTable,
  SalespersonTable,
  listHospitals,
  listSalespeople,
  updateHospital,
  updateSalesperson,
} from "@/features/master-data";
import { ProductMasterTable, listProducts, updateProduct } from "@/features/products";
import { listUsers } from "@/features/users";
import { getErrorMessage } from "@/lib/api-client";
import { AppUser, Hospital, ProductMasterItem, Salesperson } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import { PageHeader } from "@/components/shared/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Tab = "salespeople" | "hospitals" | "products";

function readInitialTab(): Tab {
  if (typeof window === "undefined") return "salespeople";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "hospitals" || value === "products" ? value : "salespeople";
}

function setTabInUrl(tab: Tab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", url.toString());
}

export default function MasterDataPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const [tab, setTabState] = useState<Tab>(readInitialTab);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [products, setProducts] = useState<ProductMasterItem[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function setTab(nextTab: Tab) {
    setTabState(nextTab);
    setTabInUrl(nextTab);
  }

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [salespeopleData, hospitalData, productsData] = await Promise.all([
        listSalespeople(token),
        listHospitals(token),
        listProducts(token),
      ]);
      setSalespeople(salespeopleData.salespeople);
      setHospitals(hospitalData.hospitals);
      setProducts(productsData.products);
      if (canEdit) {
        const usersData = await listUsers(token);
        setUsers(usersData.users);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "โหลดข้อมูล master data ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [token, canEdit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  async function handleHospitalToggle(hospital: Hospital, isPreExistingCustomer: boolean) {
    if (!token) return;
    setActionError(null);
    try {
      const data = await updateHospital(token, hospital.id, isPreExistingCustomer);
      setHospitals((prev) => prev.map((h) => (h.id === hospital.id ? data.hospital : h)));
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
      void loadAll();
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

        {loadError && <p className="mb-4 text-sm text-status-danger">{loadError}</p>}
        {actionError && <p className="mb-4 text-sm text-status-danger">{actionError}</p>}

        {loading && <p className="text-text-muted">กำลังโหลด...</p>}

        {!loading && (
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
