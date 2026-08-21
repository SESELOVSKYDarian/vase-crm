# MIGRACION_EXCEL.md — Estrategia de migración

## Estado de este entregable

No se ejecutó ninguna migración real porque los tres archivos (`Presup dvh.xlsx`, `P. PRESUPUESTO vidrio simple REV TM1.xlsx`, `Control gestion wta.xlsx`) no llegaron adjuntos — solo el texto de la especificación. Lo que sigue es el **plan** a ejecutar en cuanto estén disponibles, más el scaffold de script (`scripts/migrate-excel.ts`, a completar) donde debería implementarse.

## Orden recomendado de migración

1. **Clientes** (`Lista Nueva`) — sin dependencias, primero.
2. **Lista de precios** — necesaria antes de importar presupuestos (para no perder el snapshot histórico, se recomienda crear una `PriceList` "Histórica — migración" separada de la vigente).
3. **Presupuestos** — solo los que tengan datos completos y consistentes; el resto va a "conflictivos".
4. **OT / Producción** — enlazando por número de presupuesto cuando exista.
5. **Facturas** — clasificando automáticamente A/N según la columna detectada en el Excel de control, preservando el valor tal cual sin reinterpretarlo.
6. **Cobros y saldos** — al final, porque dependen de que existan clientes y facturas/OT válidas para poder aplicar `PaymentAllocation` sin dejar pagos huérfanos.

## Reglas de la migración

- **No importar fórmulas como datos**: cada script debe leer el *valor calculado* de la celda (no la fórmula) usando una librería de lectura de Excel que resuelva fórmulas (ej. `exceljs` con `cell.value` sobre el archivo ya calculado por Excel/LibreOffice), y **recalcular con los motores TypeScript** (`computeSimpleGlassQuote`, `computeDvhQuote`) para verificar que el resultado coincide. Si no coincide, el registro va a "conflictivos" con el detalle de la diferencia.
- **No perder el Excel original**: los archivos fuente se archivan (ej. `storage/migraciones/2026-08-20/*.xlsx`) y se referencian desde el reporte de migración, nunca se sobreescriben ni se borran.
- **Transformar, no copiar**: nombres de columnas, formatos de fecha, y valores como "Sí/No" se normalizan al tipo de dato del schema (booleanos reales, enums reales, `Decimal` en vez de texto con formato de moneda).

## Reporte de migración

Cada corrida debe producir un resumen con 4 categorías, por entidad:

| Categoría | Significado |
|---|---|
| IMPORTADOS | Se creó el registro correctamente y pasó la validación cruzada contra los motores de cálculo. |
| OMITIDOS | Filas vacías, de encabezado, o marcadas como anuladas/de prueba en el Excel — se documentan pero no se importan. |
| CONFLICTIVOS | El registro es válido pero el recálculo no coincide con el valor del Excel (diferencia de redondeo, fórmula desactualizada, etc.) — requiere revisión manual antes de aceptarse. |
| ERROR | Falta un dato obligatorio (ej. CUIT vacío) o el tipo de dato es inválido — no se puede importar sin corregir el origen. |

## Próximos pasos concretos

1. Adjuntar los 3 Excel.
2. Ejecutar un análisis hoja por hoja (nombres reales de columnas, rangos con fórmulas, listas desplegables con `Validación de datos`).
3. Completar `scripts/migrate-excel.ts` con el mapeo columna → campo Prisma específico de cada hoja.
4. Correr primero contra una base de *staging*, revisar el reporte, y recién después migrar a producción.
