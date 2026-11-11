import { EstruturaEconomia } from "@/app/economia/EstruturaEconomia";
export default function LayoutMunicipios({children}:{children:React.ReactNode}) {
  return <EstruturaEconomia tema="resumo">{children}</EstruturaEconomia>;
}
