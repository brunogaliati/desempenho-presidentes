import { Geist, Geist_Mono } from "next/font/google";
import { EstruturaEconomia } from "./EstruturaEconomia";

const sans = Geist({ subsets: ["latin"], variable: "--fonte-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--fonte-mono" });

export default function LayoutEconomia({ children }: { children: React.ReactNode }) {
  return <div className={`${sans.variable} ${mono.variable} ${sans.className}`}>
    <EstruturaEconomia>{children}</EstruturaEconomia>
  </div>;
}
