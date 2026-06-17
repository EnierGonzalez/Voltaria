"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Building2, RadioTower, ServerCog, ShieldCheck, Zap } from "lucide-react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import type {
  PlatformDashboardSummary,
  PlatformGatewaySummary,
  PlatformTenantDetail,
  PlatformTenantSummary,
  TenantIsolationDiagnostic,
  TenantProvisioningResult
} from "@voltaria/db";
import type { TenantProvisioningInput } from "@voltaria/shared";
import {
  createTenantAction,
  revokeGatewayAction,
  rotateGatewayTokenAction,
  updateTenantStatusAction
} from "@/lib/actions/platform-actions";

type TenantFormState = TenantProvisioningInput;

const initialTenantForm: TenantFormState = {
  organizationName: "",
  organizationSlug: "",
  propertyName: "",
  propertyCode: "",
  timezone: "America/Cancun",
  currency: "MXN",
  outletCount: 16,
  outletPrefix: "TOMA",
  outletAreaLabel: "Área de carga",
  defaultVoltage: 120,
  defaultMaxCurrentAmp: 12,
  tariffName: "Tarifa residencial",
  pricePerKwh: 5.5,
  allowRfid: true,
  allowMobile: true,
  maxActiveSessionsPerResident: 1,
  maxSessionDurationMinutes: 480,
  initialAdminEmail: "",
  initialAdminName: "",
  initialAdminRole: "owner",
  createDemoUsers: false,
  createGateway: true,
  gatewayKind: "simulator",
  plan: "demo"
};

export function PlatformDashboard({ summary }: { summary: PlatformDashboardSummary }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tenants" value={summary.totalTenants.toString()} delta={`${summary.activeTenants} activos/trial`} tone="primary" icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Propiedades" value={summary.totalProperties.toString()} delta={`${summary.totalOutlets} tomas controladas`} tone="cyan" icon={<Zap className="h-5 w-5" />} />
        <StatCard title="Gateways" value={summary.gatewaysOnline.toString()} delta={`${summary.gatewaysOffline} provisionados/offline`} tone="success" icon={<RadioTower className="h-5 w-5" />} />
        <StatCard title="Operación global" value={summary.activeSessions.toString()} delta={`${summary.openAlerts} alertas abiertas`} tone="warning" icon={<ShieldCheck className="h-5 w-5" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PlatformShortcut
          title="Tenants"
          description="Crear clientes, propiedades, tomas, reglas iniciales y usuario owner."
          href="/platform/tenants"
        />
        <PlatformShortcut
          title="Gateways"
          description="Provisionar gateways simulados/locales y revisar heartbeat operativo."
          href="/platform/gateways"
        />
      </section>
    </div>
  );
}

export function PlatformTenants({
  tenants,
  canManage = false
}: {
  tenants: PlatformTenantSummary[];
  canManage?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(organizationId: string, status: "active" | "disabled") {
    setMessage(null);
    startTransition(async () => {
      const result = await updateTenantStatusAction(organizationId, status);
      setMessage(result.ok ? "Tenant actualizado." : result.error ?? "No se pudo actualizar el tenant.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tenants</h1>
          <p className="text-sm text-muted">Clientes SaaS, propiedades y capacidad operativa.</p>
        </div>
        <Link
          href="/platform/tenants/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/85"
        >
          Nuevo tenant
        </Link>
      </div>

      <SectionCard title="Clientes" description="Scope global visible solo para roles platform.">
        {message ? <p className="mb-3 rounded-md border border-border bg-panel2/60 p-3 text-sm text-muted">{message}</p> : null}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-3">Cliente</th>
                <th className="hidden px-3 py-3 md:table-cell">Plan</th>
                <th className="hidden px-3 py-3 lg:table-cell">Propiedades</th>
                <th className="hidden px-3 py-3 lg:table-cell">Gateways</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="transition hover:bg-panel2/60">
                  <td className="min-w-0 px-3 py-3">
                    <Link href={`/platform/tenants/${tenant.id}`} className="block min-w-0">
                      <span className="block truncate font-medium text-foreground">{tenant.name}</span>
                      <span className="block truncate text-xs text-muted">{tenant.slug}</span>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 md:table-cell">{tenant.plan}</td>
                  <td className="hidden px-3 py-3 lg:table-cell">{tenant.propertiesCount}</td>
                  <td className="hidden px-3 py-3 lg:table-cell">{tenant.gatewaysCount}</td>
                  <td className="px-3 py-3">
                    <StatusBadge variant={tenant.status === "disabled" ? "critical" : "success"}>
                      {tenant.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <Link
                        href={`/platform/tenants/${tenant.id}`}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:border-cyan/60 hover:text-foreground"
                      >
                        Ver detalle
                      </Link>
                      {tenant.primaryPropertySlug ? (
                        <Link
                          href={`/app/${tenant.slug}/${tenant.primaryPropertySlug}/dashboard`}
                          className="rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-xs font-semibold text-cyan transition hover:bg-cyan/15"
                        >
                          Abrir tenant
                        </Link>
                      ) : (
                        <span className="rounded-md border border-border px-2 py-1 text-xs text-muted">
                          Sin propiedades
                        </span>
                      )}
                      <Link
                        href="/platform/gateways"
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted transition hover:border-cyan/60 hover:text-foreground"
                      >
                        Gateways
                      </Link>
                      {canManage ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => updateStatus(tenant.id, tenant.status === "disabled" ? "active" : "disabled")}
                          className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition hover:bg-warning/15 disabled:opacity-60"
                        >
                          {tenant.status === "disabled" ? "Activar" : "Desactivar"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function TenantProvisioningForm() {
  const [form, setForm] = useState<TenantFormState>(initialTenantForm);
  const [result, setResult] = useState<TenantProvisioningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const gatewayPreview = useMemo(
    () =>
      form.gatewayCode ||
      `GW-${form.propertyCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "TENANT"}-SIM`,
    [form.gatewayCode, form.propertyCode]
  );

  function update<K extends keyof TenantFormState>(key: K, value: TenantFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await createTenantAction(form);

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setResult(response.data);
    });
  }

  if (result) {
    const configText = JSON.stringify(result.gatewayConfig ?? {}, null, 2);

    return (
      <div className="space-y-6">
        <SectionCard title="Tenant creado" description="Estos secretos solo se muestran en esta pantalla.">
          <div className="grid gap-4 lg:grid-cols-2">
            <SecretBlock label="Admin inicial" value={result.initialAdminEmail} />
            {result.tempPassword ? <SecretBlock label="Contraseña temporal" value={result.tempPassword} /> : null}
            {result.gatewayCode ? <SecretBlock label="Gateway code" value={result.gatewayCode} /> : null}
            {result.gatewayAuthToken ? <SecretBlock label="Gateway token" value={result.gatewayAuthToken} /> : null}
            <SecretBlock
              label="Tomas creadas"
              value={result.outletsCreated > 0 ? result.outletsCreated.toString() : "Sin tomas creadas"}
            />
          </div>
          <pre className="mt-4 max-h-80 overflow-auto rounded-lg border border-border bg-background p-4 text-xs text-muted">
            {configText}
          </pre>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/platform/tenants/${result.organizationId}`} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
              Ver tenant
            </Link>
            <Link
              href={`/app/${result.organizationSlug}/${result.propertySlug}/dashboard`}
              className="rounded-md border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan transition hover:bg-cyan/15"
            >
              Abrir panel del tenant
            </Link>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(configText)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted transition hover:border-cyan/60 hover:text-foreground"
            >
              Copiar config JSON
            </button>
            <Link
              href="/platform/tenants"
              className="rounded-md border border-border px-4 py-2 text-sm text-muted transition hover:border-cyan/60 hover:text-foreground"
            >
              Volver a Tenants
            </Link>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Nuevo tenant" description="Provisiona cliente, propiedad, tomas 120V, reglas, owner y gateway.">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Cliente" value={form.organizationName} onChange={(value) => update("organizationName", value)} />
          <Field label="Slug" value={form.organizationSlug} onChange={(value) => update("organizationSlug", value.toLowerCase())} placeholder="cliente-demo" />
          <Field label="Contacto" value={form.contactName ?? ""} onChange={(value) => update("contactName", value)} />
          <Field label="Email contacto" value={form.contactEmail ?? ""} onChange={(value) => update("contactEmail", value)} />
          <Field label="Propiedad" value={form.propertyName} onChange={(value) => update("propertyName", value)} />
          <Field label="Código propiedad" value={form.propertyCode} onChange={(value) => update("propertyCode", value.toUpperCase())} placeholder="TORRE-NORTE" />
          <Field label="Dirección" value={form.address ?? ""} onChange={(value) => update("address", value)} />
          <Field label="Tomas" type="number" value={String(form.outletCount)} onChange={(value) => update("outletCount", Number(value))} />
          <Field label="Prefijo tomas" value={form.outletPrefix} onChange={(value) => update("outletPrefix", value.toUpperCase())} />
          <Field label="Área" value={form.outletAreaLabel} onChange={(value) => update("outletAreaLabel", value)} />
          <Field label="Precio kWh" type="number" value={String(form.pricePerKwh)} onChange={(value) => update("pricePerKwh", Number(value))} />
          <Field label="Máx. amperaje" type="number" value={String(form.defaultMaxCurrentAmp)} onChange={(value) => update("defaultMaxCurrentAmp", Number(value))} />
          <Field label="Admin nombre" value={form.initialAdminName} onChange={(value) => update("initialAdminName", value)} />
          <Field label="Admin email" value={form.initialAdminEmail} onChange={(value) => update("initialAdminEmail", value)} />
          <SelectField label="Rol inicial" value={form.initialAdminRole} onChange={(value) => update("initialAdminRole", value as "owner" | "admin")} options={["owner", "admin"]} />
          <SelectField label="Gateway" value={form.gatewayKind} onChange={(value) => update("gatewayKind", value as "simulator" | "local_gateway")} options={["simulator", "local_gateway"]} />
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-border bg-panel2/50 p-4 text-sm text-muted md:grid-cols-3">
          <Toggle label="RFID" checked={form.allowRfid} onChange={(value) => update("allowRfid", value)} />
          <Toggle label="Móvil" checked={form.allowMobile} onChange={(value) => update("allowMobile", value)} />
          <Toggle label="Demo users" checked={form.createDemoUsers} onChange={(value) => update("createDemoUsers", value)} />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background/50 p-4 text-sm text-muted">
          Gateway previsto: <span className="font-mono text-foreground">{gatewayPreview}</span>
        </div>

        {error ? <p className="mt-4 rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p> : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Creando..." : "Crear tenant"}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

export function PlatformTenantDetailView({
  detail,
  canManageGateways = false
}: {
  detail: PlatformTenantDetail;
  canManageGateways?: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Propiedades" value={detail.properties.length.toString()} delta={detail.slug} tone="primary" icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Tomas" value={detail.outletsCount.toString()} delta="controlled_outlet" tone="cyan" icon={<Zap className="h-5 w-5" />} />
        <StatCard title="Gateways" value={detail.gateways.length.toString()} delta="provisionados" tone="success" icon={<RadioTower className="h-5 w-5" />} />
        <StatCard title="Usuarios" value={detail.usersCount.toString()} delta={`${detail.activeTariffsCount} tarifas activas`} tone="warning" icon={<ShieldCheck className="h-5 w-5" />} />
      </section>

      <SectionCard title={detail.name} description="Resumen operativo del tenant.">
        <div className="grid gap-4 lg:grid-cols-2">
          {detail.properties.map((property) => (
            <div key={property.id} className="rounded-lg border border-border bg-panel2/60 p-4">
              <p className="font-semibold text-foreground">{property.name}</p>
              <p className="mt-1 text-sm text-muted">{property.address || "Sin dirección registrada"}</p>
              <p className="mt-3 text-xs text-muted">
                {property.outletsCount} tomas · {property.sessionsCount} sesiones · {property.usersCount} usuarios ·{" "}
                {property.gatewaysCount} gateways
              </p>
              <p className="mt-1 text-xs text-muted">{property.timezone} · {property.billingCurrency}</p>
              <Link
                href={`/app/${detail.slug}/${property.slug}/dashboard`}
                className="mt-4 inline-flex min-h-9 items-center rounded-md border border-cyan/30 bg-cyan/10 px-3 text-sm font-semibold text-cyan transition hover:bg-cyan/15"
              >
                Abrir panel del tenant
              </Link>
            </div>
          ))}
        </div>
      </SectionCard>

      <GatewayList gateways={detail.gateways} canManage={canManageGateways} />
    </div>
  );
}

export function PlatformSystemDiagnostics({
  diagnostics
}: {
  diagnostics: TenantIsolationDiagnostic[];
}) {
  const warningCount = diagnostics.reduce((total, item) => total + item.warnings.length, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Propiedades" value={diagnostics.length.toString()} delta="con scoping tenant" tone="primary" icon={<Building2 className="h-5 w-5" />} />
        <StatCard title="Tomas" value={sumDiagnostics(diagnostics, "outletsCount").toString()} delta="controlled_outlet" tone="cyan" icon={<Zap className="h-5 w-5" />} />
        <StatCard title="Gateways" value={sumDiagnostics(diagnostics, "gatewaysCount").toString()} delta="por propiedad" tone="success" icon={<RadioTower className="h-5 w-5" />} />
        <StatCard title="Warnings" value={warningCount.toString()} delta="aislamiento SaaS" tone={warningCount > 0 ? "warning" : "success"} icon={<ShieldCheck className="h-5 w-5" />} />
      </section>

      <SectionCard
        title="Tenant isolation diagnostics"
        description="Conteos agrupados por organización/propiedad y advertencias de scoping."
      >
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-3">Tenant</th>
                <th className="hidden px-3 py-3 md:table-cell">Propiedad</th>
                <th className="px-3 py-3">Tomas</th>
                <th className="hidden px-3 py-3 lg:table-cell">Sesiones</th>
                <th className="hidden px-3 py-3 lg:table-cell">Usuarios</th>
                <th className="hidden px-3 py-3 lg:table-cell">Gateways</th>
                <th className="px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {diagnostics.map((item) => (
                <tr key={item.propertyId ?? `${item.organizationId}-${item.propertySlug}`} className="align-top">
                  <td className="min-w-0 px-3 py-3">
                    <span className="block truncate font-medium text-foreground">{item.organizationName}</span>
                    <span className="block truncate text-xs text-muted">{item.organizationSlug ?? "sin-organizacion"}</span>
                  </td>
                  <td className="hidden min-w-0 px-3 py-3 md:table-cell">
                    <span className="block truncate text-foreground">{item.propertyName}</span>
                    <span className="block truncate text-xs text-muted">{item.propertySlug ?? "sin-slug"}</span>
                  </td>
                  <td className="px-3 py-3 text-foreground">{item.outletsCount}</td>
                  <td className="hidden px-3 py-3 text-foreground lg:table-cell">{item.sessionsCount}</td>
                  <td className="hidden px-3 py-3 text-foreground lg:table-cell">{item.usersCount}</td>
                  <td className="hidden px-3 py-3 text-foreground lg:table-cell">{item.gatewaysCount}</td>
                  <td className="px-3 py-3">
                    {item.warnings.length === 0 ? (
                      <StatusBadge variant="success">OK</StatusBadge>
                    ) : (
                      <div className="grid gap-2">
                        <StatusBadge variant="warning">{item.warnings.length} warning</StatusBadge>
                        <ul className="grid gap-1 text-xs text-muted">
                          {item.warnings.map((warning) => (
                            <li key={warning} className="truncate">{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function PlatformGateways({
  gateways,
  canManage = false
}: {
  gateways: PlatformGatewaySummary[];
  canManage?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Gateways</h1>
        <p className="text-sm text-muted">Dispositivos lógicos listos para simulador o gateway local.</p>
      </div>
      <GatewayList gateways={gateways} canManage={canManage} />
    </div>
  );
}

export function PlatformPlaceholder({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="rounded-lg border border-border bg-panel2/60 p-4 text-sm leading-6 text-muted">
        Esta sección pertenece al scope global de Platform Admin. No usa contexto de propiedad ni muestra
        navegación tenant.
      </div>
    </SectionCard>
  );
}

function sumDiagnostics(
  diagnostics: TenantIsolationDiagnostic[],
  key: "outletsCount" | "sessionsCount" | "gatewaysCount" | "usersCount"
) {
  return diagnostics.reduce((total, item) => total + item[key], 0);
}

function PlatformShortcut({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-border bg-panel p-5 transition hover:border-cyan/60 hover:bg-panel2/70">
      <div className="flex items-start gap-3">
        <ServerCog className="mt-1 h-5 w-5 text-cyan" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function GatewayList({
  gateways,
  canManage = false
}: {
  gateways: PlatformGatewaySummary[];
  canManage?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [rotatedToken, setRotatedToken] = useState<{
    gatewayCode: string;
    authToken: string;
    config: unknown;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function rotate(gatewayId: string) {
    setError(null);
    startTransition(async () => {
      const result = await rotateGatewayTokenAction(gatewayId);

      if (!result.ok || !result.data) {
        setError(result.error ?? "No se pudo rotar el token.");
        return;
      }

      setRotatedToken(result.data);
    });
  }

  function revoke(gatewayId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeGatewayAction(gatewayId);

      if (!result.ok) {
        setError(result.error ?? "No se pudo revocar el gateway.");
      }
    });
  }

  return (
    <SectionCard title="Gateway devices" description="No se muestran tokens persistidos. La rotación genera uno nuevo solo una vez.">
      {rotatedToken ? (
        <div className="mb-4 rounded-lg border border-cyan/30 bg-cyan/10 p-4">
          <p className="text-sm font-semibold text-foreground">Token rotado para {rotatedToken.gatewayCode}</p>
          <p className="mt-2 break-all font-mono text-xs text-cyan">{rotatedToken.authToken}</p>
          <pre className="mt-3 max-h-56 overflow-auto rounded-md border border-border bg-background p-3 text-xs text-muted">
            {JSON.stringify(rotatedToken.config, null, 2)}
          </pre>
        </div>
      ) : null}
      {error ? <p className="mb-4 rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {gateways.map((gateway) => (
          <div key={gateway.id} className="rounded-lg border border-border bg-panel2/60 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{gateway.name}</p>
                <p className="mt-1 truncate font-mono text-xs text-muted">{gateway.code}</p>
              </div>
              <StatusBadge variant={gateway.status === "online" ? "success" : gateway.status === "revoked" ? "critical" : "warning"}>
                {gateway.status}
              </StatusBadge>
            </div>
            <dl className="mt-4 grid gap-2 text-sm text-muted">
              <div className="flex justify-between gap-3"><dt>Tenant</dt><dd className="truncate text-foreground">{gateway.organizationName}</dd></div>
              <div className="flex justify-between gap-3"><dt>Propiedad</dt><dd className="truncate text-foreground">{gateway.propertyName}</dd></div>
              <div className="flex justify-between gap-3"><dt>Tipo</dt><dd className="text-foreground">{gateway.kind}</dd></div>
              <div className="flex justify-between gap-3"><dt>Heartbeat</dt><dd className="text-foreground">{gateway.lastSeenAt ? new Date(gateway.lastSeenAt).toLocaleString("es-MX") : "Sin heartbeat"}</dd></div>
            </dl>
            {canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => rotate(gateway.id)}
                  className="rounded-md border border-border px-3 py-2 text-xs text-muted transition hover:border-cyan/60 hover:text-foreground disabled:opacity-60"
                >
                  Rotar token
                </button>
                <button
                  type="button"
                  disabled={isPending || gateway.status === "revoked"}
                  onClick={() => revoke(gateway.id)}
                  className="rounded-md border border-error/30 px-3 py-2 text-xs text-error transition hover:bg-error/10 disabled:opacity-60"
                >
                  Revocar
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-md border border-border bg-background px-3 text-foreground outline-none transition placeholder:text-muted/50 focus:border-cyan"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-border bg-background px-3 text-foreground outline-none transition focus:border-cyan"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function SecretBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/60 p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-2 break-all font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}
