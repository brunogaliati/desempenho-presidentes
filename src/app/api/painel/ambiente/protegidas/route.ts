import { NextResponse } from "next/server";
import { carregarAreasProtegidas } from "@/app/_painel/_dados/carregarAreasProtegidas";
export async function GET(){return NextResponse.json(await carregarAreasProtegidas());}
