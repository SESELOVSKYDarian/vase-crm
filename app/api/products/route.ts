import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = productSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { nombre, categoria, precioM2, precioMl, vigenteDesde } = parsed.data;
    const builtIn = ["SIMPLE", "DVH", "TEMPLADO", "PULIDO", "SOLO_CORTE", "DISTRIBUCION"];
    const categoryDefinition = builtIn.includes(categoria) ? null : await prisma.productCategoryDefinition.findUnique({ where: { nombre: categoria } });
    const duplicate = await prisma.product.findFirst({ where: { nombre: { equals: nombre }, activo: true } });
    if (duplicate) return NextResponse.json({ error: "Ya existe un producto con ese nombre" }, { status: 409 });
    const product = await prisma.product.create({ data: { nombre, categoria: (builtIn.includes(categoria) ? categoria : "SIMPLE") as any, categoryDefinitionId: categoryDefinition?.id, priceItems: { create: { precioM2, precioMl: precioMl === "" || precioMl == null ? undefined : precioMl, priceList: { connectOrCreate: { where: { id: "active-default" }, create: { id: "active-default", nombre: "Lista general", vigenteDesde: new Date(vigenteDesde), activa: true } } } } } }, include: { priceItems: true, categoryDefinition: true } });
    return NextResponse.json(product, { status: 201 });
  } catch { return NextResponse.json({ error: "No se pudo crear el producto. Verificá la conexión a la base de datos." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const parsed = productSchema.partial({ precioMl: true }).safeParse(body);
  if (!id || !parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  try {
    const builtIn = ["SIMPLE", "DVH", "TEMPLADO", "PULIDO", "SOLO_CORTE", "DISTRIBUCION"];
    const categoryDefinition = builtIn.includes(parsed.data.categoria) ? null : await prisma.productCategoryDefinition.findUnique({ where: { nombre: parsed.data.categoria } });
    const product = await prisma.product.update({ where: { id }, data: { nombre: parsed.data.nombre, categoria: (builtIn.includes(parsed.data.categoria) ? parsed.data.categoria : "SIMPLE") as any, categoryDefinitionId: categoryDefinition?.id ?? null } });
    const item = await prisma.priceListItem.findFirst({ where: { productId: id }, orderBy: { createdAt: "desc" } });
    if (item) await prisma.priceListItem.update({ where: { id: item.id }, data: { precioM2: parsed.data.precioM2, precioMl: parsed.data.precioMl === "" ? null : parsed.data.precioMl, createdAt: new Date(parsed.data.vigenteDesde ?? new Date()) } });
    return NextResponse.json(product);
  } catch { return NextResponse.json({ error: "No se pudo actualizar el producto" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
  try { return NextResponse.json(await prisma.product.update({ where: { id }, data: { activo: false } })); }
  catch { return NextResponse.json({ error: "No se pudo eliminar el producto" }, { status: 500 }); }
}
