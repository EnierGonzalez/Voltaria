import { notFound, redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AuditWorkspace } from "@/components/audit-workspace";
import { BillingCycleDetail } from "@/components/billing-cycle-detail";
import { BillingWorkspace } from "@/components/billing-workspace";
import { ChargerDetail } from "@/components/charger-detail";
import { ModulePage } from "@/components/module-page";
import { OperationalRulesSettings } from "@/components/operational-rules-settings";
import { ResidentDetail } from "@/components/resident-detail";
import { RfidSimulator } from "@/components/rfid-simulator";
import { SessionDetail } from "@/components/session-detail";
import { UserManagement } from "@/components/user-management";
import { isDemoToolsEnabled } from "@/lib/deployment";
import {
  getAuditPageData,
  getBillingCycleDetailPageData,
  getBillingPageData,
  getChargerDetailPageData,
  getDashboardPageData,
  getModulePageData,
  getResidentDetailPageData,
  getRfidSimulatorPageData,
  getRulesSettingsPageData,
  getSessionDetailPageData,
  getUsersSettingsPageData
} from "@/lib/data";
import { requireTenantMembership } from "@/lib/auth";

type ModuleKey = "chargers" | "outlets" | "sessions" | "residents" | "billing" | "consumption" | "alerts" | "reports" | "settings";

export async function renderTenantDashboard(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "dashboard.view");
  const data = await getDashboardPageData(context.property.id);

  return <AdminDashboard data={data} basePath={context.basePath} />;
}

export async function renderTenantModule(
  organizationSlug: string,
  propertySlug: string,
  module: ModuleKey,
  permission:
    | "outlets.view"
    | "sessions.view"
    | "residents.view"
    | "alerts.view"
    | "reports.view"
    | "dashboard.view"
    | "rules.view"
) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, permission);
  const data = await getModulePageData(context.property.id);

  return (
    <ModulePage
      module={module}
      data={data}
      basePath={context.basePath}
      propertyName={context.property.name}
    />
  );
}

export async function renderTenantSettings(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug);

  const settingsPermissions = ["rules.view", "users.view", "system.health.view"] as const;

  if (!settingsPermissions.some((permission) => context.permissions.includes(permission))) {
    redirect("/403");
  }

  const data = await getModulePageData(context.property.id);

  return (
    <ModulePage
      module="settings"
      data={data}
      basePath={context.basePath}
      propertyName={context.property.name}
    />
  );
}

export async function renderTenantBilling(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "billing.view");
  const data = await getBillingPageData(context.property.id);

  return (
    <BillingWorkspace
      cycles={data.cycles}
      audits={data.audits}
      sessions={data.sessions}
      basePath={context.basePath}
      propertyId={context.property.id}
    />
  );
}

export async function renderTenantAudit(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "audit.view");
  const data = await getAuditPageData(context.property.id);

  return <AuditWorkspace audits={data.audits} basePath={context.basePath} />;
}

export async function renderTenantRulesSettings(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "rules.view");
  const data = await getRulesSettingsPageData(context.property.id);

  return <OperationalRulesSettings rule={data.rule} schedules={data.schedules} />;
}

export async function renderTenantUsersSettings(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "users.view");
  const data = await getUsersSettingsPageData(context.property.id);

  return (
    <UserManagement
      users={data.users}
      residents={data.residents}
      propertyId={data.propertyId}
    />
  );
}

export async function renderTenantRfidSimulator(organizationSlug: string, propertySlug: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "rfid_simulator.use");

  if (!isDemoToolsEnabled()) {
    notFound();
  }

  const data = await getRfidSimulatorPageData(context.property.id);

  return <RfidSimulator accessDevices={data.accessDevices} outlets={data.outlets} />;
}

export async function renderTenantChargerDetail(organizationSlug: string, propertySlug: string, chargerId: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "outlets.view");
  const data = await getChargerDetailPageData(chargerId);

  if (!data.charger || data.charger.propertyId !== context.property.id) {
    notFound();
  }

  return (
    <ChargerDetail
      charger={data.charger}
      sessions={data.sessions}
      logs={data.logs}
      commands={data.commands}
      outletRule={data.outletRule ?? null}
      propertyName={context.property.name}
      basePath={context.basePath}
      {...(data.currentSession ? { currentSession: data.currentSession } : {})}
    />
  );
}

export async function renderTenantSessionDetail(organizationSlug: string, propertySlug: string, sessionId: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "sessions.view");
  const data = await getSessionDetailPageData(sessionId);

  if (!data.session || data.session.propertyId !== context.property.id) {
    notFound();
  }

  return (
    <SessionDetail
      session={data.session}
      events={data.events}
      meterValues={data.meterValues}
      logs={data.logs}
      commands={data.commands}
      ruleEvaluations={data.ruleEvaluations}
      authorizationAttempts={data.authorizationAttempts}
      audit={data.audit}
    />
  );
}

export async function renderTenantResidentDetail(organizationSlug: string, propertySlug: string, residentId: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "residents.view");
  const data = await getResidentDetailPageData(residentId);

  if (!data.resident || data.resident.propertyId !== context.property.id) {
    notFound();
  }

  return (
    <ResidentDetail
      resident={data.resident}
      sessions={data.sessions}
      credentials={data.credentials}
      credentialEvents={data.credentialEvents}
      accessDevices={data.accessDevices}
      accessRule={data.accessRule}
      basePath={context.basePath}
    />
  );
}

export async function renderTenantBillingCycleDetail(organizationSlug: string, propertySlug: string, cycleId: string) {
  const context = await requireTenantMembership(organizationSlug, propertySlug, "billing.view");
  const data = await getBillingCycleDetailPageData(cycleId);

  if (!data.detail || data.detail.cycle.propertyId !== context.property.id) {
    notFound();
  }

  return <BillingCycleDetail detail={data.detail} basePath={context.basePath} />;
}
