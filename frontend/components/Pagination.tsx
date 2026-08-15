interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center justify-between text-sm text-zinc-600">
      <p>
        ทั้งหมด {total.toLocaleString("th-TH")} รายการ · หน้า {page} จาก {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          ก่อนหน้า
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
