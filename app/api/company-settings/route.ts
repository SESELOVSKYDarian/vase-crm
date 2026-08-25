import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const schema = z.object({
  logoData: z.string().nullable().optional(),
  razonSocial: z.string().trim().min(2).optional(),
  cuit: z.string().trim().optional(),
  puntoVentaDefault: z.coerce.number().int().positive().optional(),
  arcaEnvironment: z.enum(["HOMOLOGACION", "PRODUCCION"]).optional(),
  arcaCuit: z.string().trim().optional(),
  arcaPuntoVenta: z.coerce.number().int().positive().nullable().optional(),
  arcaCertificate: z.string().max(200000).nullable().optional(),
  arcaPrivateKey: z.string().max(200000).nullable().optional(),
});
export async function GET() {
  try {
    const settings = await prisma.companySettings.findFirst({
      select: {
        id: true,
        logoData: true,
        razonSocial: true,
        cuit: true,
        puntoVentaDefault: true,
        arcaEnvironment: true,
        arcaCuit: true,
        arcaPuntoVenta: true,
        arcaCertificate: true,
        arcaPrivateKey: true,
      },
    });
    if (!settings) return NextResponse.json({ data: null });
    return NextResponse.json({
      data: {
        ...settings,
        arcaCertificate: settings.arcaCertificate ? "CONFIGURADO" : "",
        arcaPrivateKey: settings.arcaPrivateKey ? "CONFIGURADA" : "",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar la configuración" },
      { status: 500 },
    );
  }
}
export async function PUT(request: Request) {
  try {
    await requirePermission("company.settings.manage");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Datos de configuración inválidos" },
        { status: 400 },
      );
    const body = parsed.data;
    if (
      body.logoData &&
      !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(body.logoData)
    )
      return NextResponse.json(
        { error: "El logo debe ser PNG, JPG o WEBP" },
        { status: 400 },
      );
    if (body.logoData && body.logoData.length > 2800000)
      return NextResponse.json(
        { error: "El logo no puede superar 2 MB" },
        { status: 400 },
      );
    const current = await prisma.companySettings.findFirst();
    const data: any = { ...body };
    if (body.arcaCertificate === "CONFIGURADO") delete data.arcaCertificate;
    if (body.arcaPrivateKey === "CONFIGURADA") delete data.arcaPrivateKey;
    const settings = current
      ? await prisma.companySettings.update({ where: { id: current.id }, data })
      : await prisma.companySettings.create({
          data: {
            ...data,
            razonSocial: body.razonSocial ?? "Vase CRM",
            cuit: body.cuit ?? "",
            condicionIva: "RESPONSABLE_INSCRIPTO",
            puntoVentaDefault: body.puntoVentaDefault ?? 1,
          },
        });
    return NextResponse.json({
      data: {
        ...settings,
        arcaCertificate: settings.arcaCertificate ? "CONFIGURADO" : "",
        arcaPrivateKey: settings.arcaPrivateKey ? "CONFIGURADA" : "",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No tenés permiso para cambiar la configuración" },
      { status: 403 },
    );
  }
}
