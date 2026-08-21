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
import { clients, priceList } from "../lib/mock-data";

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
  for (const c of clients) {
    await prisma.client.upsert({
      where: { cuit: c.cuit },
      update: {},
      create: {
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
