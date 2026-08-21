# ARCA.md — Estrategia de integración fiscal

## Estado de este entregable

`modules/arca/providers/MockArcaProvider.ts` **no se conecta a ARCA real**. Implementa el mismo contrato (`ArcaInvoiceProvider`) que tendría la integración real, simulando: numeración correlativa por punto de venta + tipo de comprobante, generación de CAE, vencimiento a 10 días, validaciones de negocio e idempotencia. Esto permite construir y testear todo el flujo de facturación, cuenta corriente y PDF sin depender de certificados.

## Reemplazo por la integración real

1. **Autenticación WSAA**
   - Generar un CMS (`openssl smime`) firmado con el certificado digital + clave privada de la empresa.
   - Enviarlo al WSAA (`wsaahomo.afip.gov.ar` en homologación) y obtener el Ticket de Acceso (Token + Sign), válido ~12hs.
   - Cachear el Ticket de Acceso (ej. en una tabla `ArcaAccessTicket` o Redis) y renovarlo antes de que expire — **nunca pedirlo en cada request**.
   - El certificado y la clave privada se guardan cifrados en el servidor (variables de entorno gestionadas por un secret manager, o un KMS), **nunca en el repositorio ni expuestos al frontend**.

2. **WSFEv1 (o WSMTXCA)**
   - `FECompUltimoAutorizado` → reemplaza `getLastAuthorizedVoucher`.
   - `FECAESolicitar` → reemplaza `authorizeInvoice`. Mapear la respuesta (`FeDetResp`) a `ArcaInvoiceResult`, incluyendo errores (`Errors`) y observaciones (`Observaciones`) sin traducir de más — guardarlos crudos en `ArcaTransaction.responsePayload` para auditoría.
   - Decidir entre WSFEv1 (más simple, ítems no van al comprobante) y WSMTXCA (permite el detalle de ítems en el comprobante) según si WTA necesita el detalle de vidrios facturado línea por línea ante ARCA o alcanza con el total. **Pendiente de definir con el cliente.**

3. **Idempotencia**
   - Mantener `ArcaTransaction.idempotencyKey` único por intento de emisión de una factura (`invoice:{invoiceId}:{intento}` o similar).
   - Antes de llamar a `FECAESolicitar`, verificar si ya existe una transacción `AUTORIZADA` para esa factura — si existe, no reintentar, devolver el resultado cacheado.
   - Si la llamada falla por timeout (no se sabe si ARCA autorizó o no), la próxima consulta debe usar `FECompConsultar` con el mismo número de comprobante antes de reintentar `FECAESolicitar`, para no arriesgarse a una autorización duplicada.

4. **Nunca marcar como autorizada sin confirmación**
   - `Invoice.estadoArca` solo pasa a `AUTORIZADA` cuando `ArcaInvoiceResult.estado === "AUTORIZADA"` **y** `cae` no es null. Cualquier otro caso queda en `PENDIENTE`, `RECHAZADA` o `ERROR`, nunca se asume éxito optimista.

## Clasificación interna A/N vs. comprobante ARCA

`Invoice.tipoFacturacion` (`A` | `N`) es un campo de **gestión interna** de WTA, heredado del Excel de control. `Invoice.arcaVoucherType` (`FACTURA_A`, `FACTURA_B`, etc.) es el tipo de comprobante fiscal real. Regla aplicada en todo el sistema:

```
tipoFacturacion = "N"  →  arcaVoucherType = null  →  nunca se llama a ArcaInvoiceProvider
tipoFacturacion = "A"  →  arcaVoucherType = FACTURA_A | FACTURA_B | FACTURA_C  →  sí se llama
```

Esto evita el error de interpretar automáticamente `N` como "Nota de Crédito" o cualquier tipo fiscal — es una clasificación de negocio, no fiscal.

## Ambientes

`ArcaInvoiceProvider.getEnvironment()` devuelve `"HOMOLOGACION"` o `"PRODUCCION"`. El cambio de ambiente debe:
- Usar credenciales/certificados distintos (homologación y producción no comparten certificado).
- Bloquear el cambio a `PRODUCCION` a nivel de configuración (`CompanySettings.arcaEnvironment`) hasta que exista un certificado de producción válido cargado.

## Riesgos conocidos

- Los Web Services de ARCA pueden tener ventanas de mantenimiento — el sistema debe degradar con gracia (dejar la factura en `PENDIENTE`, permitir reintentar manualmente) en vez de bloquear el flujo comercial completo.
- El mapeo de condición de IVA del cliente a `clienteDocTipo`/`condicionIvaReceptor` de ARCA tiene reglas específicas (ej. Consumidor Final con importes menores a cierto monto no requiere documento) que deben confirmarse con el contador de WTA antes de ir a producción.
