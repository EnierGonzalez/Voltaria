"use server";

import { revalidatePath } from "next/cache";
import {
  createTenant,
  generateGatewayConfig,
  revokeGateway,
  rotateGatewayToken,
  updatePlatformTenantStatus,
  type TenantProvisioningResult
} from "@voltaria/db";
import { recordIdSchema, tenantProvisioningSchema, type TenantProvisioningInput } from "@voltaria/shared";
import { requireActionPermission, withDbContext } from "@/lib/auth";

export type PlatformActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createTenantAction(
  input: TenantProvisioningInput
): Promise<PlatformActionResult<TenantProvisioningResult>> {
  await requireActionPermission("platform.tenants.manage");
  const parsed = tenantProvisioningSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Datos de tenant inválidos." };
  }

  try {
    const result = await withDbContext(({ db }) => createTenant(db, parsed.data));
    revalidatePlatformPaths();
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el tenant."
    };
  }
}

export async function rotateGatewayTokenAction(gatewayId: string) {
  await requireActionPermission("platform.gateways.manage");
  const parsed = recordIdSchema.safeParse(gatewayId);

  if (!parsed.success) {
    return { ok: false, error: "Gateway inválido." };
  }

  try {
    const result = await withDbContext(async ({ db }) => {
      const rotated = await rotateGatewayToken(db, parsed.data);
      return {
        gatewayId: rotated.gatewayId,
        gatewayCode: rotated.gatewayCode,
        authToken: rotated.authToken,
        config: await generateGatewayConfig(db, rotated.gatewayId, {
          authToken: rotated.authToken
        })
      };
    });
    revalidatePlatformPaths();
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo rotar el token."
    };
  }
}

export async function revokeGatewayAction(gatewayId: string) {
  await requireActionPermission("platform.gateways.manage");
  const parsed = recordIdSchema.safeParse(gatewayId);

  if (!parsed.success) {
    return { ok: false, error: "Gateway inválido." };
  }

  try {
    await withDbContext(({ db }) => revokeGateway(db, parsed.data));
    revalidatePlatformPaths();
    return { ok: true, data: { gatewayId: parsed.data } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo revocar el gateway."
    };
  }
}

export async function updateTenantStatusAction(
  organizationId: string,
  status: "active" | "trial" | "suspended" | "disabled"
) {
  await requireActionPermission("platform.tenants.manage");
  const parsed = recordIdSchema.safeParse(organizationId);

  if (!parsed.success) {
    return { ok: false, error: "Tenant inválido." };
  }

  try {
    await withDbContext(({ db }) => updatePlatformTenantStatus(db, parsed.data, status));
    revalidatePlatformPaths();
    return { ok: true, data: { organizationId: parsed.data, status } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar el tenant."
    };
  }
}

function revalidatePlatformPaths() {
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath("/platform/gateways");
}
