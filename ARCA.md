# Integración ARCA

Vase CRM integra WSAA y WSFEv1 contra **homologación**. Producción permanece bloqueada salvo que `ARCA_PRODUCTION_ENABLED=true`.

## Seguridad

- Certificado y clave privada se cifran en MySQL con AES-256-GCM.
- `ARCA_CREDENTIALS_MASTER_KEY` se obtiene exclusivamente del entorno; nunca se genera automáticamente.
- El frontend recibe solamente indicadores de configuración y metadata no sensible.
- Token y Sign de WSAA se guardan cifrados en `ArcaAccessTicket` y se renuevan cinco minutos antes de expirar.

## Providers

- `MockArcaProvider`: pruebas unitarias y desarrollo aislado.
- `WsfeArcaProvider`: proveedor real que firma el TRA, solicita WSAA y consume WSFEv1.

El contenedor instala OpenSSL. La firma usa un directorio temporal privado y se elimina al finalizar.

## Variables

```env
ARCA_CREDENTIALS_MASTER_KEY=<base64 de 32 bytes>
ARCA_PRODUCTION_ENABLED=false
ARCA_HTTP_TIMEOUT_MS=15000
```

Generar la master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Migración

Después de definir la master key:

```bash
npx prisma db push
npm run arca:migrate-credentials
```

El script detecta valores antiguos no cifrados y los cifra sin imprimirlos.

## Homologación

1. Obtenga el certificado de testing en WSASS de ARCA y asígnelo al servicio `wsfe`.
2. Cargue CUIT, punto de venta, certificado PEM y clave PEM en Configuración → ARCA.
3. Ejecute las pruebas de credenciales, WSAA y WSFEv1.

Las URLs están centralizadas en `modules/arca/endpoints.ts` y se basan en documentación oficial de ARCA.

## Producción

No se habilita por defecto. Requiere certificado, delegación y revisión fiscal específica.
