import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "ค่าคงที่การประเมิน · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
