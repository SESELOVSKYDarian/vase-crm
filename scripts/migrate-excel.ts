/**
 * Scaffold del script de migración de Excel → Vase Management.
 * Ver MIGRACION_EXCEL.md para el plan completo.
 *
 * Pendiente: adjuntar los 3 Excel reales y completar el mapeo
 * columna → campo Prisma por cada hoja. Este archivo documenta la
 * forma esperada del reporte de migración para que la implementación
 * futura no tenga que redefinir el contrato.
 */

export type MigrationRowResult =
  | { status: "IMPORTADO"; entidad: string; id: string }
  | { status: "OMITIDO"; entidad: string; motivo: string }
  | { status: "CONFLICTIVO"; entidad: string; motivo: string; valorExcel: unknown; valorRecalculado: unknown }
  | { status: "ERROR"; entidad: string; motivo: string };

export interface MigrationReport {
  entidad: string;
  importados: number;
  omitidos: number;
  conflictivos: number;
  errores: number;
  detalle: MigrationRowResult[];
}

async function main() {
  console.log(
    "Este script requiere los archivos Excel originales (no incluidos en este entregable). " +
      "Ver MIGRACION_EXCEL.md para el plan de implementación."
  );
}

main();
