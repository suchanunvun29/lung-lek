import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "ข้อมูลการขาย · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
