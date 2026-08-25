if (!process.env.ARCA_HOMOLOGACION_TEST) {
  console.log(
    "Omitido: definí ARCA_HOMOLOGACION_TEST=true y credenciales válidas para ejecutar pruebas externas.",
  );
  process.exit(0);
}
console.log(
  "Usá Configuración → ARCA y facturación para ejecutar el diagnóstico autenticado de homologación.",
);
