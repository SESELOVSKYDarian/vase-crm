import { describe, expect, it } from "vitest";
import { assertCrudAllowed, hasUserActivity, SUPER_ADMIN_ERROR } from "@/lib/user-protection";

describe("protected administrative account", () => {
  it("blocks normal CRUD for the designated super administrator", () => {
    expect(() => assertCrudAllowed(true)).toThrow("SUPER_ADMIN_PROTECTED");
    expect(SUPER_ADMIN_ERROR).toContain("no puede modificarse");
  });

  it("allows CRUD for a secondary administrator or operational user", () => {
    expect(() => assertCrudAllowed(false)).not.toThrow();
  });

  it("detects operational history to select safe deactivation", () => {
    expect(hasUserActivity({ auditLogs: 0, progressEntries: 1, notifications: 0 })).toBe(true);
    expect(hasUserActivity({ auditLogs: 0, progressEntries: 0, notifications: 0 })).toBe(false);
  });
});
