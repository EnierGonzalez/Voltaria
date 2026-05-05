"use client";

import { Clock3, Gauge, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import type {
  AccessScheduleWindowSummary,
  PropertyAccessRuleSummary
} from "@voltaria/shared";
import { updatePropertyAccessRuleAction } from "@/lib/actions/rules-actions";
import { EmptyState } from "./empty-state";

type OperationalRulesSettingsProps = {
  rule: PropertyAccessRuleSummary | null;
  schedules: AccessScheduleWindowSummary[];
};

const INPUT_CLASS =
  "min-h-10 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan";

export function OperationalRulesSettings({ rule, schedules }: OperationalRulesSettingsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstSchedule = schedules[0];
  const [form, setForm] = useState(() => ({
    name: rule?.name ?? "Regla residencial estándar",
    active: rule?.active ?? true,
    allowRfid: rule?.allowRfid ?? true,
    allowMobile: rule?.allowMobile ?? true,
    allowAdmin: rule?.allowAdmin ?? true,
    maxActiveSessionsPerResident: String(rule?.maxActiveSessionsPerResident ?? 1),
    maxActiveSessionsPerApartment: String(rule?.maxActiveSessionsPerApartment ?? 2),
    maxActiveSessionsProperty: String(rule?.maxActiveSessionsProperty ?? 16),
    maxSessionDurationMinutes: String(rule?.maxSessionDurationMinutes ?? 480),
    maxSessionKwh: rule?.maxSessionKwh ? String(rule.maxSessionKwh) : "",
    maxSessionCost: rule?.maxSessionCost ? String(rule.maxSessionCost) : "",
    startupNoLoadTimeoutSeconds: String(rule?.startupNoLoadTimeoutSeconds ?? 90),
    noLoadTimeoutSeconds: String(rule?.noLoadTimeoutSeconds ?? 600),
    lowPowerThresholdWatts: String(rule?.lowPowerThresholdWatts ?? 20),
    overcurrentAction: rule?.overcurrentAction ?? "stop_session",
    defaultMaxCurrentAmp: String(rule?.defaultMaxCurrentAmp ?? 12),
    scheduleStartTime: firstSchedule?.startTime ?? "00:00",
    scheduleEndTime: firstSchedule?.endTime ?? "23:59"
  }));

  const scheduleSummary = useMemo(() => {
    if (schedules.length === 0) {
      return "24/7";
    }

    const unique = new Set(schedules.map((item) => `${item.startTime}-${item.endTime}`));
    return unique.size === 1
      ? `${schedules[0]?.startTime ?? "00:00"}-${schedules[0]?.endTime ?? "23:59"} · diario`
      : `${schedules.length} ventanas activas`;
  }, [schedules]);

  if (!rule) {
    return (
      <SectionCard title="Reglas operativas" description="Sin regla activa">
        <EmptyState
          title="No hay regla activa"
          description="Ejecuta el seed o crea una regla para habilitar el motor operativo."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Regla activa"
          value={rule.name}
          delta={rule.active ? "Evaluación habilitada" : "Pausada"}
          tone={rule.active ? "success" : "warning"}
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Horario"
          value={scheduleSummary}
          delta="Ventanas por propiedad"
          tone="cyan"
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Límite residente"
          value={`${rule.maxActiveSessionsPerResident}`}
          delta="Sesiones activas simultáneas"
          tone="primary"
          icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          title="Corriente default"
          value={`${rule.defaultMaxCurrentAmp ?? 12} A`}
          delta="Para tomas sin límite propio"
          tone="success"
          icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <SectionCard
        title="Motor de reglas"
        description="Controla métodos, horarios y límites antes de crear sesión o comando."
        action={<StatusBadge variant={form.active ? "success" : "warning"}>{form.active ? "Activa" : "Pausada"}</StatusBadge>}
      >
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => {
              void (async () => {
                const result = await updatePropertyAccessRuleAction({
                  ruleId: rule.id,
                  name: form.name,
                  active: form.active,
                  allowRfid: form.allowRfid,
                  allowMobile: form.allowMobile,
                  allowAdmin: form.allowAdmin,
                  maxActiveSessionsPerResident: toInteger(form.maxActiveSessionsPerResident),
                  maxActiveSessionsPerApartment: toInteger(form.maxActiveSessionsPerApartment),
                  maxActiveSessionsProperty: toOptionalNumber(form.maxActiveSessionsProperty),
                  maxSessionDurationMinutes: toOptionalNumber(form.maxSessionDurationMinutes),
                  maxSessionKwh: toOptionalNumber(form.maxSessionKwh),
                  maxSessionCost: toOptionalNumber(form.maxSessionCost),
                  startupNoLoadTimeoutSeconds: toInteger(form.startupNoLoadTimeoutSeconds),
                  noLoadTimeoutSeconds: toInteger(form.noLoadTimeoutSeconds),
                  lowPowerThresholdWatts: toNumber(form.lowPowerThresholdWatts),
                  overcurrentAction: form.overcurrentAction,
                  defaultMaxCurrentAmp: toOptionalNumber(form.defaultMaxCurrentAmp),
                  scheduleStartTime: form.scheduleStartTime,
                  scheduleEndTime: form.scheduleEndTime
                });
                setMessage(result.ok ? result.message ?? "Reglas actualizadas." : result.error ?? "No se pudo guardar.");
              })();
            });
          }}
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <Field label="Nombre">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Horario inicio">
              <input
                type="time"
                value={form.scheduleStartTime}
                onChange={(event) => setForm((current) => ({ ...current, scheduleStartTime: event.target.value }))}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Horario fin">
              <input
                type="time"
                value={form.scheduleEndTime}
                onChange={(event) => setForm((current) => ({ ...current, scheduleEndTime: event.target.value }))}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Toggle label="Regla activa" checked={form.active} onChange={(active) => setForm((current) => ({ ...current, active }))} />
            <Toggle label="RFID" checked={form.allowRfid} onChange={(allowRfid) => setForm((current) => ({ ...current, allowRfid }))} />
            <Toggle label="Móvil" checked={form.allowMobile} onChange={(allowMobile) => setForm((current) => ({ ...current, allowMobile }))} />
            <Toggle label="Admin" checked={form.allowAdmin} onChange={(allowAdmin) => setForm((current) => ({ ...current, allowAdmin }))} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NumberField label="Sesiones por residente" value={form.maxActiveSessionsPerResident} onChange={(value) => setForm((current) => ({ ...current, maxActiveSessionsPerResident: value }))} />
            <NumberField label="Sesiones por departamento" value={form.maxActiveSessionsPerApartment} onChange={(value) => setForm((current) => ({ ...current, maxActiveSessionsPerApartment: value }))} />
            <NumberField label="Sesiones de propiedad" value={form.maxActiveSessionsProperty} onChange={(value) => setForm((current) => ({ ...current, maxActiveSessionsProperty: value }))} />
            <NumberField label="Duración máx. min" value={form.maxSessionDurationMinutes} onChange={(value) => setForm((current) => ({ ...current, maxSessionDurationMinutes: value }))} />
            <NumberField label="kWh máx. sesión" value={form.maxSessionKwh} onChange={(value) => setForm((current) => ({ ...current, maxSessionKwh: value }))} />
            <NumberField label="Costo máx. sesión" value={form.maxSessionCost} onChange={(value) => setForm((current) => ({ ...current, maxSessionCost: value }))} />
            <NumberField label="Startup no-load s" value={form.startupNoLoadTimeoutSeconds} onChange={(value) => setForm((current) => ({ ...current, startupNoLoadTimeoutSeconds: value }))} />
            <NumberField label="No-load s" value={form.noLoadTimeoutSeconds} onChange={(value) => setForm((current) => ({ ...current, noLoadTimeoutSeconds: value }))} />
            <NumberField label="Umbral baja W" value={form.lowPowerThresholdWatts} onChange={(value) => setForm((current) => ({ ...current, lowPowerThresholdWatts: value }))} />
            <NumberField label="Corriente default A" value={form.defaultMaxCurrentAmp} onChange={(value) => setForm((current) => ({ ...current, defaultMaxCurrentAmp: value }))} />
            <Field label="Sobrecorriente">
              <select
                value={form.overcurrentAction}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    overcurrentAction: event.target.value as "alert_only" | "stop_session"
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="stop_session">Detener sesión</option>
                <option value="alert_only">Solo alerta</option>
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan/40 bg-cyan/12 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Guardando..." : "Guardar reglas"}
            </button>
            {message ? <p className="text-sm text-muted">{message}</p> : null}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </Field>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-panel2/64 px-3 text-sm text-foreground">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan"
      />
    </label>
  );
}

function toInteger(value: string) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function toNumber(value: string) {
  return Number(value) || 0;
}

function toOptionalNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && value.trim().length > 0 ? number : undefined;
}
