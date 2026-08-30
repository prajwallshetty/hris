import { describe, expect, it } from "vitest";

import { assertCan, can, ForbiddenError, type SessionUser } from "../rbac";

function user(role: SessionUser["role"], overrides: Partial<SessionUser> = {}): SessionUser {
  return { id: "u1", role, coordinatorId: null, clientId: null, ...overrides };
}

describe("can", () => {
  it("grants SUPER_ADMIN full access, including user management", () => {
    const admin = user("SUPER_ADMIN");
    expect(can(admin, "create", "worker")).toBe(true);
    expect(can(admin, "archive", "invoice")).toBe(true);
    expect(can(admin, "create", "user")).toBe(true);
  });

  it("denies ADMIN user management, unlike SUPER_ADMIN", () => {
    const admin = user("ADMIN");
    expect(can(admin, "create", "worker")).toBe(true);
    expect(can(admin, "create", "invoice")).toBe(true);
    expect(can(admin, "create", "user")).toBe(false);
  });

  it("gives ACCOUNTS full control over finance but read-only on worker master data", () => {
    const accounts = user("ACCOUNTS");
    expect(can(accounts, "create", "invoice")).toBe(true);
    expect(can(accounts, "create", "workerPayment")).toBe(true);
    expect(can(accounts, "view", "worker")).toBe(true);
    expect(can(accounts, "create", "worker")).toBe(false);
    expect(can(accounts, "archive", "worker")).toBe(false);
  });

  it("gives HR full control over workforce/HR data but only read access to finance", () => {
    const hr = user("HR");
    expect(can(hr, "create", "worker")).toBe(true);
    expect(can(hr, "create", "employee")).toBe(true);
    expect(can(hr, "view", "workerPayroll")).toBe(true);
    expect(can(hr, "create", "invoice")).toBe(false);
  });

  it("restricts COORDINATOR to view-only worker/client access plus their own sales", () => {
    const coordinator = user("COORDINATOR", { coordinatorId: "co1" });
    expect(can(coordinator, "view", "worker")).toBe(true);
    expect(can(coordinator, "create", "worker")).toBe(false);
    expect(can(coordinator, "create", "sale")).toBe(true);
    expect(can(coordinator, "create", "commission")).toBe(false);
  });

  it("restricts CLIENT to viewing only their own invoices/workers, never mutating", () => {
    const client = user("CLIENT", { clientId: "cl1" });
    expect(can(client, "view", "invoice")).toBe(true);
    expect(can(client, "create", "invoice")).toBe(false);
    expect(can(client, "view", "worker")).toBe(true);
    expect(can(client, "archive", "worker")).toBe(false);
  });

  it("grants EMPLOYEE no cross-record access by default", () => {
    const employee = user("EMPLOYEE");
    expect(can(employee, "view", "worker")).toBe(false);
    expect(can(employee, "view", "employee")).toBe(false);
  });

  it("denies an unknown action/resource combination rather than throwing", () => {
    const hr = user("HR");
    expect(can(hr, "create", "commission")).toBe(false);
  });
});

describe("assertCan", () => {
  it("throws ForbiddenError when the action is not permitted", () => {
    const client = user("CLIENT", { clientId: "cl1" });
    expect(() => assertCan(client, "create", "invoice")).toThrow(ForbiddenError);
  });

  it("does not throw when the action is permitted", () => {
    const admin = user("SUPER_ADMIN");
    expect(() => assertCan(admin, "create", "worker")).not.toThrow();
  });
});
