"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getErrorMessage,
  listHospitals,
  listSalespeople,
  listUsers,
  updateHospital,
  updateSalesperson,
} from "@/lib/api";
import { AppUser, Hospital, Salesperson } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import HospitalTable from "@/components/masterData/HospitalTable";
import SalespersonTable from "@/components/masterData/SalespersonTable";

type Tab = "salespeople" | "hospitals";

export default function MasterDataPage() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = currentUser?.role === "MANAGER";

  const [tab, setTab] = useState<Tab>("salespeople");
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [salespeopleData, hospitalData] = await Promise.all([
        listSalespeople(token),
        listHospitals(token),
      ]);
      setSalespeople(salespeopleData.salespeople);
      setHospitals(hospitalData.hospitals);
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

  async function handleSalespersonLink(salesperson: Salesperson, userId: string | null) {
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

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-zinc-900">จัดการ Master Data</h1>
      {!canEdit && (
        <p className="mt-1 text-sm text-zinc-600">คุณสามารถดูข้อมูลได้เท่านั้น การแก้ไขสงวนไว้สำหรับผู้จัดการ</p>
      )}

      <div className="mt-4 flex gap-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("salespeople")}
          className={`rounded px-3 py-1.5 font-medium ${
            tab === "salespeople" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          พนักงานขาย
        </button>
        <button
          type="button"
          onClick={() => setTab("hospitals")}
          className={`rounded px-3 py-1.5 font-medium ${
            tab === "hospitals" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          โรงพยาบาล
        </button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}

      <div className="mt-4">
        {loading && <p className="text-zinc-400">กำลังโหลด...</p>}

        {!loading && tab === "salespeople" && (
          <SalespersonTable
            salespeople={salespeople}
            linkableUsers={users}
            canEdit={canEdit}
            onLink={handleSalespersonLink}
            onEmploymentDate={handleEmploymentDate}
          />
        )}

        {!loading && tab === "hospitals" && (
          <HospitalTable hospitals={hospitals} canEdit={canEdit} onToggle={handleHospitalToggle} />
        )}
      </div>
    </div>
  );
}
