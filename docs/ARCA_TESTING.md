# Pruebas ARCA en homologación

1. Configure `ARCA_CREDENTIALS_MASTER_KEY` y ejecute `npx prisma db push`.
2. En ARCA/WSASS obtenga un certificado de testing y asígnelo a `wsfe`.
3. Abra **Configuración → ARCA y facturación**.
4. Cargue CUIT, punto de venta, certificado PEM y clave PEM.
5. Guarde y ejecute el diagnóstico.

El diagnóstico sólo consulta WSAA, WSFEv1 y `FECompUltimoAutorizado`; no invoca `FECAESolicitar`.

Para un entorno aislado: `ARCA_HOMOLOGACION_TEST=true npm run test:arca:homo`.

No use credenciales productivas en homologación ni suba PEM/keys al repositorio.
