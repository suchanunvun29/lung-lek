import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "ตัวช่วยตั้งเป้า · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
