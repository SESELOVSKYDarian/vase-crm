import type { User, Role, RoleDefinition, RolePermission, Permission } from "@prisma/client";

type UserWithPermissions = User & { userRoles: Array<{ role: RoleDefinition & { permissions: Array<RolePermission & { permission: Permission }> } }> };

const legacyPermissions: Partial<Record<Role, string[]>> = {
  ADMIN: ["*"],
  VENTAS: ["clients.view", "clients.create", "clients.edit", "clients.delete", "quotes.view", "quotes.create", "quotes.edit", "quotes.delete", "quotes.send", "quotes.approve", "quotes.reject", "production.view_all", "production.assign"],
  CORTE: ["production.view_assigned", "production.update_assigned", "production.cut.progress.update"],
  ARMADO: ["production.view_assigned", "production.update_assigned", "production.assembly.progress.update"],
  PRODUCCION: ["production.view_all", "production.assign", "production.work_order.status.update"],
  ADMINISTRACION: ["clients.view", "quotes.view", "invoices.view", "payments.view"],
};

export function hasPermission(user: UserWithPermissions, permission: string) {
  const rolePermissions = user.userRoles.flatMap((entry) => entry.role.active ? entry.role.permissions.map((item) => item.permission.key) : []);
  // Configurable roles are authoritative. The enum only supports users from
  // before the migration, who have no UserRole records at all.
  if (user.userRoles.length > 0) return rolePermissions.includes(permission) || rolePermissions.includes("*");
  const legacy = legacyPermissions[user.role] ?? [];
  return legacy.includes(permission) || legacy.includes("*");
}

export function hasAnyPermission(user: UserWithPermissions, permissions: string[]) {
  return permissions.some((permission) => hasPermission(user, permission));
}
