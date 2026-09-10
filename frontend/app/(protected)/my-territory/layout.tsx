import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "พื้นที่รับผิดชอบ · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
