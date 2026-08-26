import { describe, expect, it } from "vitest";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

const user = (legacyRole: string, keys: string[] = []) => ({
  role: legacyRole,
  userRoles: [{ role: { active: true, permissions: keys.map((key) => ({ permission: { key } })) } }],
}) as any;

describe("configurable role permissions", () => {
  it("does not merge the legacy ADMINISTRACION enum into a CORTADOR role", () => {
    const cutter = user("ADMINISTRACION", ["production.view_assigned", "production.cut.progress.update"]);
    expect(hasPermission(cutter, "production.view_assigned")).toBe(true);
    expect(hasPermission(cutter, "quotes.view")).toBe(false);
    expect(hasPermission(cutter, "invoices.view")).toBe(false);
    expect(hasPermission(cutter, "payments.view")).toBe(false);
  });

  it("unions only assigned roles without granting administrative permissions", () => {
    const cutterAndAssembler = { role: "ADMINISTRACION", userRoles: [
      { role: { active: true, permissions: [{ permission: { key: "production.view_assigned" } }, { permission: { key: "production.cut.progress.update" } }] } },
      { role: { active: true, permissions: [{ permission: { key: "production.assembly.progress.update" } }] } },
    ] } as any;
    expect(hasAnyPermission(cutterAndAssembler, ["production.cut.progress.update", "production.assembly.progress.update"])).toBe(true);
    expect(hasPermission(cutterAndAssembler, "analytics.view")).toBe(false);
  });

  it("retains the enum fallback only for legacy accounts without UserRole records", () => {
    expect(hasPermission({ role: "ADMIN", userRoles: [] } as any, "anything")).toBe(true);
  });
});
