# ARQUITECTURA.md — Vase Management

## Stack

- **Next.js 14 (App Router)** + TypeScript, Server Actions/Route Handlers para lógica crítica.
- **PostgreSQL + Prisma** como capa de persistencia de producción (`prisma/schema.prisma`).
- **Tailwind CSS** + primitivas propias estilo shadcn/ui, con tokens de marca Vase.
- **Framer Motion** para transición de páginas, entrada/salida de modales, tablero kanban y micro-interacciones.
- **Recharts** para dashboard y analíticas.
- **Zod + React Hook Form** (integrados en el esqueleto; los formularios de demo usan estado local controlado para que el cálculo en vivo sea inmediato).
- **decimal.js** en todos los motores de cálculo — nunca `number` crudo para dinero.
- **Vitest** para tests de los motores de cálculo.

## Por qué el demo no usa una base de datos real

El zip está pensado para poder abrirse y ejecutarse (`npm install && npm run dev`) sin depender de un servidor PostgreSQL, credenciales, ni certificados ARCA reales. Por eso:

- `lib/mock-data.ts` reemplaza las consultas a la base durante la demo con datos en memoria, con la misma forma (`types/index.ts`) que tendrían los modelos de Prisma serializados.
- `prisma/schema.prisma` es el modelo de datos **real**, listo para `prisma migrate dev` apenas haya un `DATABASE_URL`.
- El siguiente paso natural (fuera de este entregable) es reemplazar cada `import { x } from "@/lib/mock-data"` por un `repository` que llame a Prisma, sin tocar los componentes de UI — la forma de los datos ya coincide.

## Capas

```
app/                 → rutas (App Router), una carpeta por pantalla
  (app)/              → grupo de rutas autenticadas (sidebar + topbar)
components/
  ui/                 → primitivas (Button, Card, Modal, Badge, Tabs...)
  layout/             → Sidebar, Topbar, PageTransition
  shared/              → badges de estado reutilizados entre pantallas
  quotes/, production/ → componentes específicos de dominio
lib/
  calculations/        → motores puros y testeables (simple-glass.ts, dvh.ts)
  mock-data.ts          → datos de demo (reemplazar por repositories/ en prod)
  format.ts, utils.ts
modules/
  arca/                 → abstracción ArcaInvoiceProvider + implementación mock
types/                  → tipos de dominio compartidos
prisma/
  schema.prisma          → modelo de datos real de producción
```

En producción, la carpeta `modules/` crecería con un `repositories/` (Prisma) y `services/` (orquestación: aprobar presupuesto → generar OT, confirmar remito → actualizar stock entregado, etc.), pero se mantiene la misma separación: **la lógica crítica (cálculo, validación, ARCA) nunca vive en un componente de React**, siempre en `lib/` o `modules/`.

## Motores de cálculo

`lib/calculations/simple-glass.ts` y `lib/calculations/dvh.ts` son funciones puras (sin I/O) que reciben un `input` tipado y devuelven el `input` enriquecido con todos los campos calculados, más una función de totalización por presupuesto. Estos mismos módulos:

- Se usan en vivo en los formularios de "Nuevo presupuesto" (`app/(app)/presupuestos/nuevo/*`).
- Se usarían sin cambios en un Server Action / Route Handler que persista el presupuesto — la UI y el backend comparten el mismo cálculo, evitando divergencias.
- Están cubiertos por tests (`lib/calculations/__tests__/*.test.ts`) que se pueden correr con `npm run test`.

## Módulo ARCA

`modules/arca/types.ts` define el contrato `ArcaInvoiceProvider`. `modules/arca/providers/MockArcaProvider.ts` lo implementa con numeración correlativa simulada, CAE ficticio y las mismas validaciones de negocio que tendría el Web Service real (CUIT válido, totales consistentes, Factura A requiere CUIT del receptor). Ver `ARCA.md` para el plan de reemplazo por WSAA/WSFEv1 reales.

## Decisiones de diseño relevantes

- **Snapshot de precios**: `QuoteItem.precioM2Snapshot` (y equivalentes) se graban en el momento de crear el presupuesto. La lista de precios (`PriceListItem`) puede cambiar libremente sin tocar presupuestos históricos.
- **Separación de tres estados en la OT** (productivo / entrega / facturación): permite que producción actualice avance sin que eso dispare cambios en facturación, y viceversa.
- **`tipo_facturacion` (A/N) separado de `arca_voucher_type`**: una factura N nunca puede terminar llamando por accidente al proveedor ARCA, porque `arca_voucher_type` es `null` para esos registros y el código de facturación nunca invoca `ArcaInvoiceProvider` si `tipoFacturacion !== "A"`.
- **Idempotencia de ARCA**: `ArcaTransaction.idempotencyKey` es único; el proveedor cachea el resultado por key antes de reintentar una llamada, evitando duplicar autorizaciones ante una caída de red.
