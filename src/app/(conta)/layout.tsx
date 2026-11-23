import type { Metadata } from "next";
import { EstruturaConta } from "./EstruturaConta";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LayoutConta({ children }: { children: React.ReactNode }) {
  return <EstruturaConta>{children}</EstruturaConta>;
}
