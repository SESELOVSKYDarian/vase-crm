# Vase CRM

Sistema web integral para WTA: clientes, presupuestos (vidrio simple y DVH), órdenes de trabajo, producción (corte/armado), entregas, remitos, facturación (con clasificación interna A/N y abstracción de integración ARCA), cobros, cuenta corriente y analíticas.

## Antes de empezar — alcance real de este entregable

Este proyecto se generó **sin los tres archivos Excel originales** (`Presup dvh.xlsx`, `P. PRESUPUESTO vidrio simple REV TM1.xlsx`, `Control gestion wta.xlsx`) — solo se contó con la especificación funcional escrita. Por eso:

- La app corre **sin base de datos**, con datos de demo en memoria (`lib/mock-data.ts`), para que puedas abrirla y navegarla de punta a punta de inmediato.
- El **modelo de datos de producción** (`prisma/schema.prisma`) está completo y listo para `prisma migrate dev` en cuanto haya un Postgres disponible.
- Los **motores de cálculo** de Vidrio Simple y DVH (`lib/calculations/`) están implementados y testeados con ejemplos representativos — deben re-validarse contra los Excel reales apenas estén disponibles (ver `ANALISIS_FUNCIONAL.md` y `MIGRACION_EXCEL.md`).
- La **integración ARCA** es una abstracción (`ArcaInvoiceProvider`) con una implementación mock que simula homologación — no se conecta a los Web Services reales de AFIP/ARCA, que requieren certificado digital (ver `ARCA.md`).

Lean los 6 documentos en la raíz del proyecto (`ANALISIS_FUNCIONAL.md`, `ARQUITECTURA.md`, `DATABASE.md`, `ARCA.md`, `MIGRACION_EXCEL.md`, `ROADMAP.md`) para el detalle completo de qué está implementado y qué queda pendiente.

## Cómo correrlo

Requiere Node.js 18.18+ (recomendado 20 LTS).

```bash
npm install
npm run dev
```

### Docker con MySQL local

Copiá `.env.docker.example` como `.env`, completá `DATABASE_URL` y ejecutá `docker compose up --build`. En Windows, `host.docker.internal` conecta el contenedor con el MySQL instalado en tu computadora. El contenedor sincroniza Prisma automáticamente antes de iniciar Vase CRM. Usá `SEED_DATABASE=true` sólo si querés cargar datos demo.

Abrí [http://localhost:3000](http://localhost:3000) — redirige automáticamente a `/dashboard`.

## Tests de los motores de cálculo

```bash
npm run test
```

Corre los tests de `lib/calculations/__tests__/` que validan m², metros lineales de pulido, bonificaciones, IVA, totales de vidrio simple y de DVH (costo, margen, subtotales).

## Estructura

Ver `ARQUITECTURA.md` para el detalle. En resumen:

```
app/(app)/…        pantallas del ERP (dashboard, clientes, presupuestos, producción, …)
components/         UI (primitivas + layout + componentes de dominio)
lib/calculations/    motores de cálculo puros (vidrio simple, DVH) + tests
lib/mock-data.ts      datos de demo (reemplazar por Prisma en producción)
modules/arca/         abstracción de integración fiscal ARCA
prisma/schema.prisma   modelo de datos de producción
```

## Marca

- Verde Vase: `#16A34A`
- Fondo claro: `#F8FAFC` · Fondo oscuro: `#0F1115` · Negro de marca: `#09090B`
- Tipografía: Inter (UI) + JetBrains Mono (datos tabulares/numéricos)
- El toggle claro/oscuro está arriba a la derecha, junto a las notificaciones.

## Próximos pasos sugeridos

Ver `ROADMAP.md`. En orden: (1) adjuntar los Excel reales y re-validar los motores de cálculo, (2) conectar Postgres + Prisma reemplazando `mock-data.ts`, (3) implementar el proveedor ARCA real sobre WSAA/WSFEv1 con certificado de homologación.
