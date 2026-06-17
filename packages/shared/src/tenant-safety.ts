export type TenantFallbackContext = {
  flow: string;
  propertyId?: string | null | undefined;
  organizationId?: string | null | undefined;
  userId?: string | null | undefined;
};

export class TenantFallbackBlockedError extends Error {
  constructor(flow: string) {
    super(
      `Tenant context is required for ${flow}. Default tenant fallback is disabled outside development demo mode.`
    );
    this.name = "TenantFallbackBlockedError";
  }
}

export function isDevelopmentDemoTenantFallbackAllowed(
  env: Record<string, string | undefined> = process.env
) {
  return (env.APP_ENV ?? "development") === "development" && env.ENABLE_DEMO_TOOLS === "true";
}

export function hasExplicitTenantContext(context: TenantFallbackContext) {
  return Boolean(context.propertyId || context.organizationId || context.userId);
}

export function assertNoDefaultTenantFallbackInProduction(context: TenantFallbackContext) {
  if (hasExplicitTenantContext(context)) {
    return;
  }

  if (isDevelopmentDemoTenantFallbackAllowed()) {
    return;
  }

  throw new TenantFallbackBlockedError(context.flow);
}

export function isTenantFallbackBlockedError(error: unknown) {
  return error instanceof TenantFallbackBlockedError || (error as Error | null)?.name === "TenantFallbackBlockedError";
}
