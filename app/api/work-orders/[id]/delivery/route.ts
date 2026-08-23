import { NextResponse } from "next/server";
// Compatibilidad segura: las entregas definitivas sólo se generan al confirmar un remito.
export async function PATCH() { return NextResponse.json({ error: "La entrega se confirma desde Remitos. Primero prepará un borrador de despacho." }, { status: 410 }); }
