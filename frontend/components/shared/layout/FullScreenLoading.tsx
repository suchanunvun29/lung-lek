import { Spinner } from "@/components/ui/spinner";

export function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle flex-col gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-text-muted font-medium">กำลังโหลด...</p>
    </div>
  );
}

export default FullScreenLoading;
