import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "เปลี่ยนรหัสผ่าน · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
