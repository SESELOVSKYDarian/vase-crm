# ANÁLISIS_FUNCIONAL.md — Vase Management (ex WTA)

## 0. Nota sobre el alcance de este análisis

Este análisis fue redactado **a partir del brief funcional detallado que se proporcionó por escrito**, no a partir de los archivos `Presup dvh.xlsx`, `P. PRESUPUESTO vidrio simple REV TM1.xlsx` y `Control gestion wta.xlsx`, que no llegaron adjuntos a la conversación (solo el texto de la especificación).

Todo lo que sigue es una interpretación fiel de esa especificación, tratada como si fuera el resultado de haber leído los tres Excel. Antes de considerar este análisis definitivo, se recomienda:

1. Adjuntar los tres archivos reales.
2. Correr una segunda pasada de este mismo análisis hoja por hoja, celda por celda, contrastando cada fórmula contra las funciones TypeScript ya implementadas en `lib/calculations/`.
3. Ajustar los casos de test (`__tests__/*.test.ts`) para que reproduzcan ejemplos reales tomados de los Excel, no solo ejemplos representativos como los actuales.

Todo lo demás del sistema (arquitectura, modelo de datos, motores de cálculo, UI) fue construido para que ese ajuste sea de "encajar números reales", no de rediseñar nada.

---

## 1. Los tres Excel, tal como los describe el brief

### 1.1 `P. PRESUPUESTO vidrio simple REV TM1.xlsx`
Función: generador de presupuestos de vidrio simple.

Campos manuales identificados: número, fecha, cliente, código cliente, CUIT, domicilio, obra, fecha de entrega, observaciones, y por ítem: producto, cantidad, ancho, alto, caras pulidas en ancho, caras pulidas en alto, precio por m², precio de pulido, bonificación.

Campos calculados identificados: m² por ítem, metros lineales de pulido, subtotal de vidrio, subtotal de pulido, subtotal, bonificación en monto, subtotal neto, IVA, total, cantidad total de vidrios, m² total.

Fórmula crítica reconstruida (ver `lib/calculations/simple-glass.ts`):
```
m²_unitario   = ancho_m * alto_m
m²_total      = m²_unitario * cantidad
ml_pulido     = (caras_ancho * ancho_m + caras_alto * alto_m) * cantidad
subtotal      = m²_total * precio_m2 + ml_pulido * precio_pulido_ml
bonificación  = subtotal * bonificacion_pct / 100
subtotal_neto = subtotal - bonificación
iva           = subtotal_neto * 21%
total         = subtotal_neto + iva
```

### 1.2 `Presup dvh.xlsx`
Función: generador de presupuestos de DVH (doble vidriado hermético), con al menos dos hojas relevantes: `CALCULO DVH` y `$ INSUMOS`.

Campos manuales identificados: vidrio exterior, vidrio interior, composición, cantidad, ancho, alto, espesor, cámara, separador, sellado, bonificación.

Campos calculados identificados: m², costo de insumos, costo total, precio, subtotal.

Fórmula crítica reconstruida (ver `lib/calculations/dvh.ts`):
```
m²_unitario         = ancho_m * alto_m
perímetro_ml        = 2 * (ancho_m + alto_m)
costo_vidrio_ext     = m²_unitario * precio_m2(vidrio_ext)
costo_vidrio_int     = m²_unitario * precio_m2(vidrio_int)
costo_separador      = perímetro_ml * precio_ml(separador)
costo_sellado        = perímetro_ml * precio_ml(sellado)
costo_unitario       = suma anteriores + insumos_extra
precio_venta_unitario = costo_unitario * (1 + margen_pct / 100)
subtotal_bruto        = precio_venta_unitario * cantidad
bonificación           = subtotal_bruto * bonificacion_pct / 100
subtotal_neto          = subtotal_bruto - bonificación
```

**Pendiente de confirmar contra el Excel real**: la política de margen (¿es un % fijo por composición, una tabla, o una fórmula de markup variable según espesor?). El sistema lo dejó parametrizado por ítem (`margenPct`) precisamente para no perder generalidad hasta confirmar esto.

### 1.3 `Control gestion wta.xlsx`
Función: control de gestión — producción, cobros, facturación, saldos, clientes ("Lista Nueva"), resumen ejecutivo ("Resumen").

Hojas y función inferida:
- **Lista Nueva**: maestro de clientes (razón social, CUIT, condición IVA, contacto).
- **Producción / OT**: seguimiento de órdenes de trabajo, estado, operario, avance.
- **Cobros**: registro de pagos por cliente, método, moneda, retenciones.
- **Resumen**: métricas agregadas — base de las Analíticas del sistema nuevo.

Clasificación interna detectada: `A` / `N` en el tipo de facturación (ver sección 6 del brief y `types/index.ts` → `TipoFacturacion`). Esta clasificación **no es un tipo de comprobante ARCA**; se mantuvo separada de `arca_voucher_type` tal como exige el brief.

---

## 2. Flujo completo detectado

```
CLIENTE → PRESUPUESTO (Simple | DVH) → [aprobación] → OT
  → (Simple: OT de corte) | (DVH: OT de corte + OT de armado)
  → PRODUCCIÓN (tablero, avance)
  → ENTREGA (parcial o completa)
  → REMITO
  → FACTURA (tipo A vía ARCA | tipo N interna)
  → COBRO (con distribución entre OT / acopio / cuenta corriente)
  → CUENTA CORRIENTE
```

Cada nodo conserva una referencia (FK) al nodo anterior — nunca se duplica información de cliente/obra/ítems más allá de lo estrictamente necesario para el snapshot histórico de precios.

---

## 3. Estados

| Entidad | Estados |
|---|---|
| Presupuesto | BORRADOR, ENVIADO, APROBADO, RECHAZADO, VENCIDO, ANULADO |
| OT (productivo) | PENDIENTE, EN_PROCESO, TERMINADA, ANULADA |
| OT (entrega) | SIN_ENTREGAR, ENTREGA_PARCIAL, ENTREGA_COMPLETA |
| OT (facturación) | SIN_FACTURAR, FACTURADA_PARCIAL, FACTURADA |
| Factura (ARCA) | NO_APLICA, PENDIENTE, AUTORIZADA, RECHAZADA, ERROR |
| Remito | CONFIRMADO, ANULADO |

Los tres estados de una OT (productivo, entrega, facturación) son independientes entre sí, tal como exige el brief.

---

## 4. Reglas de negocio clave

1. Solo un presupuesto **APROBADO** puede generar una OT.
2. Al crear un presupuesto se guarda un **snapshot** de los precios usados (`precioM2Snapshot`, etc.) — un cambio posterior en la lista de precios nunca modifica presupuestos históricos.
3. Nunca se permite entregar más cantidad que la pendiente.
4. Una factura tipo A solo puede marcarse AUTORIZADA si ARCA confirmó la autorización — nunca de forma optimista.
5. Reintentos de autorización ante ARCA son idempotentes (`ArcaTransaction.idempotencyKey` único) — no pueden generar una factura duplicada.
6. Un pago puede distribuirse (`PaymentAllocation`) entre varias OT, acopio o cuenta corriente sin duplicar el monto original.
7. `tipo_facturacion` (A/N) y `arca_voucher_type` son campos separados; `N` nunca dispara lógica de ARCA.
8. Montos monetarios siempre en `Decimal`, nunca `float`.

---

## 5. Inconsistencias / dudas a resolver con los Excel reales

- Confirmar si el IVA en vidrio simple es siempre 21% o varía según producto (templado, laminado).
- Confirmar la fórmula exacta de margen/markup de DVH por composición.
- Confirmar si existen más de 2 caras pulidas posibles por eje (el brief solo menciona "caras pulidas en ancho/alto", se asumió 0/1/2).
- Confirmar el criterio exacto que hoy decide `A` vs `N` en el Excel de control (¿el vendedor lo tipea, o depende del cliente/condición IVA?).
- Confirmar el criterio de vencimiento de un presupuesto (¿días fijos desde emisión?).

Ver `ROADMAP.md` para cómo se propone cerrar estas dudas.
