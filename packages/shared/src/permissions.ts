export const appRoles = [
  "owner",
  "admin",
  "operations",
  "accounting",
  "auditor",
  "resident",
  "support"
] as const;

export type AppRole = (typeof appRoles)[number];

export const appPermissions = [
  "dashboard.view",
  "outlets.view",
  "outlets.control",
  "outlets.maintenance",
  "outlets.configure",
  "sessions.view",
  "sessions.stop",
  "sessions.audit",
  "residents.view",
  "residents.manage",
  "credentials.view",
  "credentials.manage",
  "credentials.replace",
  "credentials.disable",
  "rules.view",
  "rules.manage",
  "billing.view",
  "billing.manage",
  "billing.approve",
  "billing.export",
  "audit.view",
  "audit.manage",
  "users.view",
  "users.manage",
  "users.manage_roles",
  "rfid_simulator.use",
  "system.health.view",
  "system.logs.view",
  "reports.view",
  "reports.export",
  "alerts.view",
  "mobile.charge.view",
  "mobile.charge.start",
  "mobile.charge.stop_own",
  "mobile.access.view",
  "mobile.history.view"
] as const;

export type AppPermission = (typeof appPermissions)[number];

const allPermissions = [...appPermissions];

export const rolePermissions: Record<AppRole, AppPermission[]> = {
  owner: allPermissions,
  admin: allPermissions.filter((permission) => permission !== "users.manage_roles"),
  operations: [
    "dashboard.view",
    "outlets.view",
    "outlets.control",
    "outlets.maintenance",
    "sessions.view",
    "sessions.stop",
    "residents.view",
    "alerts.view"
  ],
  accounting: [
    "dashboard.view",
    "sessions.view",
    "billing.view",
    "billing.manage",
    "billing.export",
    "audit.view",
    "reports.view",
    "reports.export"
  ],
  auditor: [
    "dashboard.view",
    "outlets.view",
    "sessions.view",
    "billing.view",
    "audit.view",
    "reports.view"
  ],
  resident: [
    "mobile.charge.view",
    "mobile.charge.start",
    "mobile.charge.stop_own",
    "mobile.access.view",
    "mobile.history.view"
  ],
  support: [
    "dashboard.view",
    "outlets.view",
    "sessions.view",
    "rfid_simulator.use",
    "system.health.view",
    "system.logs.view"
  ]
};

export function getPermissionsForRole(role: AppRole): AppPermission[] {
  return rolePermissions[role];
}

export function roleHasPermission(role: AppRole, permission: AppPermission) {
  return rolePermissions[role].includes(permission);
}

export function hasAnyPermission(
  permissions: readonly AppPermission[],
  required: readonly AppPermission[]
) {
  return required.some((permission) => permissions.includes(permission));
}
