export const SUPER_ADMIN_ERROR = "La cuenta administradora principal no puede modificarse desde este módulo.";

export function assertCrudAllowed(isSuperAdmin: boolean) {
  if (isSuperAdmin) throw new Error("SUPER_ADMIN_PROTECTED");
}

export function hasUserActivity(counts: Record<string, number>) {
  return Object.values(counts).some((count) => count > 0);
}
