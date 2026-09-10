import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "ย้าย รพ. เข้าเขต · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
