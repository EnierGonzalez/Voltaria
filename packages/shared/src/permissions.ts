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
  "platform.tenants.view",
  "platform.tenants.manage",
  "platform.gateways.view",
  "platform.gateways.manage",
  "platform.impersonate_property",
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

export const platformRoles = [
  "none",
  "platform_owner",
  "platform_admin",
  "platform_support"
] as const;

export type PlatformRole = (typeof platformRoles)[number];

const allPermissions = [...appPermissions];
const propertyPermissions = appPermissions.filter(
  (permission) => !permission.startsWith("platform.")
);

export const rolePermissions: Record<AppRole, AppPermission[]> = {
  owner: propertyPermissions,
  admin: propertyPermissions.filter((permission) => permission !== "users.manage_roles"),
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

export const platformRolePermissions: Record<PlatformRole, AppPermission[]> = {
  none: [],
  platform_owner: allPermissions,
  platform_admin: allPermissions.filter(
    (permission) => permission !== "platform.impersonate_property"
  ),
  platform_support: ["platform.tenants.view", "platform.gateways.view", "system.health.view"]
};

export function getPermissionsForRole(role: AppRole): AppPermission[] {
  return rolePermissions[role];
}

export function getPermissionsForPlatformRole(role: PlatformRole): AppPermission[] {
  return platformRolePermissions[role];
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
