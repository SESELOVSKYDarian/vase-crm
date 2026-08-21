import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ razonSocial: z.string().trim().min(2), cuit: z.string().trim().min(6), condicionIva: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"]), domicilio: z.string().trim().min(2), telefono: z.string().optional(), email: z.string().email().optional().or(z.literal("")), contacto: z.string().optional() });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos" }, { status: 400 });
  try { const count = await prisma.client.count(); const client = await prisma.client.create({ data: { ...parsed.data, codigoCliente: `VASE-${String(count + 1).padStart(4, "0")}`, email: parsed.data.email || null } }); return NextResponse.json(client, { status: 201 }); }
  catch (error: any) { return NextResponse.json({ error: error?.code === "P2002" ? "El CUIT ya está registrado" : "No se pudo crear el cliente" }, { status: 500 }); }
}
