/**
 * Script de seed de referencia para Prisma. Pensado para correr una vez
 * exista un DATABASE_URL real y se haya corrido `prisma migrate dev`.
 *
 * Reutiliza los mismos datos de demo que ve la UI (lib/mock-data.ts) para
 * que el ambiente de desarrollo con base real luzca igual que la demo.
 *
 * NOTA: este script es un punto de partida — antes de correrlo en un
 * ambiente real, reemplazar por datos migrados desde los Excel (ver
 * MIGRACION_EXCEL.md) en vez de datos ficticios.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { clients, priceList, quotes, workOrders } from "../lib/mock-data";

const prisma = new PrismaClient();

async function main() {
  for (const nombre of ["SIMPLE", "DVH", "TEMPLADO", "PULIDO", "SOLO_CORTE", "DISTRIBUCION"]) {
    await prisma.productCategoryDefinition.upsert({ where: { nombre }, update: { activa: true }, create: { nombre, sistema: true, activa: true } });
  }
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync("Admin1234!", salt, 64).toString("hex")}`;
  await prisma.user.upsert({
    where: { email: "admin@vasecrm.com" },
    update: { active: true, role: "ADMIN" },
    create: { name: "Administrador Vase CRM", email: "admin@vasecrm.com", passwordHash, role: "ADMIN", active: true },
  });
  console.log("Administrador creado: admin@vasecrm.com");
  console.log("Seed de referencia — adaptar a datos reales migrados desde Excel.");
  const seededClients = new Map<string, string>();
  for (const c of clients) {
    const client = await prisma.client.upsert({
      where: { cuit: c.cuit },
      update: {},
      create: {
        id: c.id,
        codigoCliente: c.codigoCliente,
        razonSocial: c.razonSocial,
        cuit: c.cuit,
        condicionIva: c.condicionIva as any,
        domicilio: c.domicilio,
        telefono: c.telefono,
        email: c.email,
        contacto: c.contacto,
        estado: c.estado as any,
      },
    });
    seededClients.set(c.id, client.id);
  }
  for (const quote of quotes) {
    const clientId = seededClients.get(quote.clienteId);
    if (!clientId) continue;
    await prisma.quote.upsert({
      where: { numero: quote.numero },
      update: {},
      create: { id: quote.id, numero: quote.numero, tipo: quote.tipo, fecha: new Date(quote.fecha), fechaEntrega: new Date(quote.fechaEntrega), clientId, obra: quote.obra, observaciones: quote.observaciones, estado: quote.estado, tipoFacturacion: quote.tipoFacturacion, cantidadTotal: quote.cantidadTotal, m2Total: quote.m2Total, subtotalBruto: quote.subtotalBruto, montoBonificacion: quote.montoBonificacion, subtotalNeto: quote.subtotalNeto, iva: quote.iva, total: quote.total, items: { create: { productoNombre: quote.tipo === "DVH" ? "DVH" : "Float 4mm", cantidad: quote.cantidadTotal, anchoMm: 1000, altoMm: 1000, precioM2Snapshot: quote.subtotalBruto / Math.max(quote.m2Total, 1), subtotalNeto: quote.subtotalNeto } } },
    });
  }
  for (const order of workOrders.filter((item) => ["ot-2001", "ot-2002", "ot-2004"].includes(item.id))) {
    const clientId = seededClients.get(order.clienteId);
    if (!clientId) continue;
    await prisma.workOrder.upsert({
      where: { numero: order.numero },
      update: {},
      create: { id: order.id, numero: order.numero, quoteId: order.quoteId, clientId, obra: order.obra, categoria: order.categoria, fechaCreacion: new Date(order.fechaCreacion), fechaEntrega: new Date(order.fechaEntrega), prioridad: order.prioridad, porcentajeAvance: order.porcentajeAvance, estadoProductivo: order.estadoProductivo, estadoEntrega: order.estadoEntrega, estadoFacturacion: order.estadoFacturacion, items: { create: { productoNombre: order.tipo, cantidad: order.cantidadTotal, anchoMm: 1000, altoMm: 1000, m2: order.m2Total } } },
    });
  }
  console.log(`Clientes de referencia creados: ${clients.length}`);
  console.log(`Ítems de lista de precios de referencia (no migrados, solo informativo): ${priceList.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
