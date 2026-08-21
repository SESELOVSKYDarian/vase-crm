# DATABASE.md — Modelo de datos

Ver `prisma/schema.prisma` para la fuente de verdad. Este documento explica el razonamiento.

## Diagrama de relaciones (simplificado)

```
Client ──< Quote ──< QuoteItem ──(1:1)── SimpleGlassDetail | DvhDetail
   │           │
   │           └──(1:1)── WorkOrder ──< WorkOrderItem
   │                          │
   │                          ├──(1:1)── CutOrder ──< CutOrderItem
   │                          ├──(1:1)── AssemblyOrder ──< AssemblyOrderItem
   │                          ├──< Delivery ──< DeliveryItem
   │                          ├──< DeliveryNote ──< DeliveryNoteItem
   │                          └──< Invoice ──< InvoiceItem
   │                                    │
   │                                    └──< ArcaTransaction
   │
   ├──< Payment ──< PaymentAllocation ──> Invoice
   │        └──< Retention
   │
   └──< AccountMovement

User ──< AuditLog
User ──< Quote (createdBy)
User ──< WorkOrder (operario)
```

## Por qué cada entidad existe

- **Quote / QuoteItem / SimpleGlassDetail / DvhDetail**: se separó el detalle específico de Simple y DVH en tablas propias en lugar de una tabla `QuoteItem` con 30 columnas nullable. `QuoteItem` guarda lo común (cantidad, medidas, precio snapshot, subtotal); el detalle vive en la tabla correspondiente al tipo, referenciada 1:1.
- **WorkOrder separado de Quote**: aunque hay una relación 1:1 hoy (una OT por presupuesto aprobado), se modeló como entidad propia porque su ciclo de vida es distinto (estados productivos, operario, avance) y porque el brief pide "no duplicar información, pero mantener trazabilidad" — WorkOrder solo referencia `quoteId`, no copia los ítems.
- **CutOrder / AssemblyOrder como 1:1 de WorkOrder**: para DVH, la OT general "contiene" una orden de corte y una de armado; para Simple, solo una orden de corte. Modelarlas como entidades propias (no como un campo `tipo` en una tabla genérica) refleja que tienen operarios, fechas e ítems distintos.
- **DeliveryNote vs. Delivery**: `Delivery` registra la entrega física (cantidad entregada, fecha) que alimenta el estado de entrega de la OT; `DeliveryNote` es el documento remito (inmutable tras confirmarse) que puede agrupar una o más entregas. Se separaron porque el brief exige que el remito sea inmutable salvo anulación controlada, mientras que el registro de avance de entrega necesita poder actualizarse.
- **Invoice.tipoFacturacion vs. arcaVoucherType**: campos independientes por requerimiento explícito del brief. `arcaVoucherType` es `null` cuando `tipoFacturacion = N`.
- **ArcaTransaction**: log técnico e idempotente, uno por intento de autorización (no uno por factura), para poder auditar reintentos sin perder historial y para anclar la idempotencia (`idempotencyKey` único).
- **PaymentAllocation**: permite que un `Payment` se reparta entre varias `Invoice`/OT o cuenta corriente sin duplicar el importe — la suma de `allocations.monto` de un pago nunca debería superar `Payment.importe` (regla de negocio a validar en el service layer, no solo en el schema).
- **AccountMovement**: tabla de solo-inserción (append-only) que construye el extracto cronológico; `saldo` es un campo desnormalizado a propósito (mismo patrón que un libro contable) para que el extracto no tenga que recalcular sumas históricas en cada lectura.
- **Decimal en todos los montos**: nunca `Float`, por el requerimiento explícito de no perder precisión en dinero.

## Índices

Se indexó cada FK usada en filtros frecuentes (`clientId`, `estado*`, `tipoFacturacion`, `fecha`) porque las pantallas de producción, facturación y cuenta corriente filtran y ordenan por esos campos constantemente.

## Migración de precios (bonus)

Se optó por `PriceList` + `PriceListItem` (en vez de un solo precio en `Product`) para soportar listas vigentes por rango de fechas sin borrar históricas — esto es lo que permite el snapshot en `QuoteItem` y a la vez mantener trazabilidad de qué lista estaba activa cuando se armó cada presupuesto.
