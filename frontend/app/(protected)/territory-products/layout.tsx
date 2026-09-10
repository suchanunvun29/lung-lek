import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "อันดับสินค้า · ระบบประเมินพนักงานขาย",
    template: "%s · ระบบประเมินพนักงานขาย",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
