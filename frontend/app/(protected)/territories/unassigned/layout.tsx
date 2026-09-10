import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "รพ. ที่ยังไม่ผูกเขต · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
