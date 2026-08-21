# ROADMAP.md

## Ya entregado en este zip

- [x] App Next.js completa y navegable de punta a punta (dashboard → clientes → presupuestos → producción → entregas → remitos → facturación → cobros → cuenta corriente → analíticas → precios → configuración), con datos de demo.
- [x] Motor de cálculo de Vidrio Simple, puro y testeado (`lib/calculations/simple-glass.ts`).
- [x] Motor de cálculo de DVH, puro y testeado (`lib/calculations/dvh.ts`).
- [x] Formularios de presupuesto Simple y DVH con cálculo en vivo (misma lógica que se usaría en el backend).
- [x] Traza completa Cliente → Presupuesto → OT → Corte/Armado → Entrega → Remito → Factura → Cobro, navegable en ambos sentidos.
- [x] Modelo de datos completo en Prisma (`prisma/schema.prisma`), con la separación `tipoFacturacion` (A/N) vs. `arcaVoucherType`.
- [x] Abstracción `ArcaInvoiceProvider` + implementación mock con idempotencia y validaciones.
- [x] UI con identidad Vase (verde `#16A34A`), modo claro/oscuro, animaciones de transición de página, modales y tablero de producción con Framer Motion.
- [x] Documentación: este set de 6 documentos.

## Fase 2 — con los Excel reales

- [ ] Adjuntar los 3 Excel y re-ejecutar el análisis funcional celda por celda.
- [ ] Ajustar `lib/calculations/*` si aparecen reglas no contempladas (ej. IVA distinto según producto, tabla de margen DVH por composición).
- [ ] Completar `scripts/migrate-excel.ts` y correr la migración a una base de staging.

## Fase 3 — backend real

- [ ] Provisionar PostgreSQL y correr `prisma migrate dev`.
- [ ] Reemplazar `lib/mock-data.ts` por `repositories/` que consulten Prisma (la forma de los datos ya coincide con `types/index.ts`, así que la UI no debería requerir cambios grandes).
- [ ] Server Actions / Route Handlers para: crear/aprobar presupuesto, generar OT, confirmar remito, generar factura, registrar cobro y su distribución.
- [ ] Auth.js con roles (`Role` enum ya definido) y middleware de autorización por ruta.
- [ ] `audit_logs` conectados a cada mutación crítica.

## Fase 4 — ARCA real

- [ ] Certificado digital de homologación de WTA.
- [ ] Implementar `WsaaArcaProvider` (o el nombre que se elija) cumpliendo `ArcaInvoiceProvider`, primero contra homologación.
- [ ] Validar un lote de facturas de prueba contra el padrón de ARCA.
- [ ] Pasar a producción solo después de una ventana de testing sin observaciones.

## Fase 5 — PDF y documentos

- [ ] Generación de PDF de presupuesto, orden de corte, orden de armado, remito, factura y recibo (diseño ya definido por la identidad Vase; falta la capa de generación, ej. `@react-pdf/renderer` o Puppeteer server-side).

## Fase 6 — pulido operativo

- [ ] Buscador global funcional (hoy es un input de UI sin backend conectado).
- [ ] Columnas configurables y paginación real en tablas grandes.
- [ ] Notificaciones (vencimiento de presupuestos, CAE por vencer, OT atrasadas).
