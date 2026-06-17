"use client";

import { KeyRound, Plus, RadioTower, RotateCcw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatKwh,
  type AccessDeviceSummary,
  type ChargingSessionSummary,
  type CredentialEventSummary,
  type ResidentAccessRuleSummary,
  type ResidentSummary,
  type RfidCredentialSummary
} from "@voltaria/shared";
import {
  cancelCredentialEnrollmentAction,
  createManualRfidCredentialAction,
  disableCredentialAction,
  getEnrollmentStatusAction,
  markCredentialDamagedAction,
  markCredentialLostAction,
  markCredentialStolenAction,
  replaceCredentialStartAction,
  startCredentialEnrollmentAction
} from "@/lib/actions/credential-actions";
import { setResidentAccessOverrideAction } from "@/lib/actions/rules-actions";
import { EmptyState } from "./empty-state";

type ResidentDetailProps = {
  resident: ResidentSummary;
  sessions: ChargingSessionSummary[];
  credentials: RfidCredentialSummary[];
  credentialEvents: CredentialEventSummary[];
  accessDevices: AccessDeviceSummary[];
  accessRule: ResidentAccessRuleSummary | null;
  basePath?: string;
};

export function ResidentDetail({
  resident,
  sessions,
  credentials,
  credentialEvents,
  accessDevices,
  accessRule,
  basePath = ""
}: ResidentDetailProps) {
  const [manualTag, setManualTag] = useState("");
  const [manualLabel, setManualLabel] = useState("Tarjeta principal");
  const [readerId, setReaderId] = useState(accessDevices[0]?.id ?? "");
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);
  const [capturedMaskedValue, setCapturedMaskedValue] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ruleStatus, setRuleStatus] = useState(accessRule?.status ?? "allowed");
  const [allowRfid, setAllowRfid] = useState(accessRule?.allowRfid ?? true);
  const [allowMobile, setAllowMobile] = useState(accessRule?.allowMobile ?? true);
  const [ruleNotes, setRuleNotes] = useState(accessRule?.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const activeCredential = useMemo(
    () => credentials.find((credential) => credential.status === "active") ?? null,
    [credentials]
  );

  useEffect(() => {
    if (!enrollmentId || enrollmentStatus === "captured" || enrollmentStatus === "cancelled") {
      return;
    }

    const timer = window.setInterval(() => {
      void (async () => {
        const result = await getEnrollmentStatusAction(enrollmentId);

        if (!result.ok) {
          setMessage(result.error);
          return;
        }

        setEnrollmentStatus(result.status);

        if (result.maskedValue) {
          setCapturedMaskedValue(result.maskedValue);
        }

        if (result.status !== "waiting") {
          router.refresh();
        }
      })();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [enrollmentId, enrollmentStatus, router]);

  const runAction = (action: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    startTransition(() => {
      void (async () => {
        const result = await action();
        setMessage(result.ok ? result.message ?? "Acción completada." : result.error ?? "No se pudo completar.");
        router.refresh();
      })();
    });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Residente" value={resident.name} delta={resident.email} tone="primary" />
        <StatCard title="Departamento" value={resident.apartmentNumber} delta={resident.propertyName} tone="cyan" />
        <StatCard title="Consumo mensual" value={formatKwh(resident.monthlyKwh)} delta={formatCurrency(resident.monthlyCost)} tone="success" />
        <StatCard title="RFID" value={activeCredential ? activeCredential.maskedValue : "Sin tarjeta"} delta={activeCredential ? activeCredential.statusLabel : "Asignación pendiente"} tone={activeCredential ? "success" : "warning"} />
      </section>

      <SectionCard
        title="Reglas de acceso"
        description="Overrides operativos para este residente"
        action={<StatusBadge variant={ruleStatus === "allowed" ? "success" : ruleStatus === "limited" ? "warning" : "critical"}>{accessRule?.statusLabel ?? "Permitido"}</StatusBadge>}
      >
        <div className="grid gap-4 xl:grid-cols-[220px_1fr_auto]">
          <label className="grid gap-2 text-sm text-muted">
            Estado
            <select
              value={ruleStatus}
              onChange={(event) => setRuleStatus(event.target.value as ResidentAccessRuleSummary["status"])}
              className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
            >
              <option value="allowed">Permitido</option>
              <option value="blocked">Bloqueado</option>
              <option value="suspended">Suspendido</option>
              <option value="limited">Limitado</option>
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border bg-panel2/64 px-3 text-sm text-foreground">
              RFID
              <input
                type="checkbox"
                checked={allowRfid}
                onChange={(event) => setAllowRfid(event.target.checked)}
                className="h-4 w-4 accent-cyan"
              />
            </label>
            <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border bg-panel2/64 px-3 text-sm text-foreground">
              Móvil
              <input
                type="checkbox"
                checked={allowMobile}
                onChange={(event) => setAllowMobile(event.target.checked)}
                className="h-4 w-4 accent-cyan"
              />
            </label>
            <input
              value={ruleNotes}
              onChange={(event) => setRuleNotes(event.target.value)}
              placeholder="Notas operativas"
              className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
            />
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(() =>
                setResidentAccessOverrideAction({
                  residentId: resident.id,
                  status: ruleStatus,
                  allowRfid,
                  allowMobile,
                  notes: ruleNotes
                })
              )
            }
            className="min-h-10 rounded-md border border-cyan/40 bg-cyan/12 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:opacity-60"
          >
            Guardar reglas
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(() =>
                setResidentAccessOverrideAction({
                  residentId: resident.id,
                  status: "blocked",
                  allowRfid: false,
                  allowMobile: false,
                  notes: "Bloqueado desde operación"
                })
              )
            }
            className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
          >
            Bloquear carga
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(() =>
                setResidentAccessOverrideAction({
                  residentId: resident.id,
                  status: "allowed",
                  allowRfid: true,
                  allowMobile: true,
                  notes: "Acceso restaurado"
                })
              )
            }
            className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-semibold text-success transition hover:bg-success/20 disabled:opacity-50"
          >
            Desbloquear
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(() =>
                setResidentAccessOverrideAction({
                  residentId: resident.id,
                  status: "limited",
                  allowRfid,
                  allowMobile,
                  maxSessionDurationMinutes: 120,
                  notes: "Limitado a 120 minutos"
                })
              )
            }
            className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition hover:bg-warning/20 disabled:opacity-50"
          >
            Limitar
          </button>
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="Credenciales RFID"
          description="Solo se muestra el valor enmascarado. El idTag completo no se guarda visible."
          action={<StatusBadge variant={activeCredential ? "success" : "warning"}>{activeCredential ? "Acceso activo" : "Sin tarjeta activa"}</StatusBadge>}
        >
          <div className="space-y-3">
            {credentials.length === 0 ? (
              <EmptyState title="Sin credenciales RFID" description="Asigna una tarjeta manualmente o captura desde lector." />
            ) : (
              credentials.map((credential) => (
                <div key={credential.id} className="min-w-0 rounded-lg border border-border bg-panel2/64 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{credential.label}</p>
                      <p className="mt-1 truncate text-sm text-muted">{credential.maskedValue}</p>
                    </div>
                    <StatusBadge variant={credentialStatusVariant(credential.status)}>{credential.statusLabel}</StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                    <span>Creada {formatDateTime(credential.createdAt)}</span>
                    <span>{credential.lastUsedAt ? `Último uso ${formatDateTime(credential.lastUsedAt)}` : "Sin uso registrado"}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending || credential.status !== "active"}
                      onClick={() => {
                        const reason = window.prompt("Motivo para desactivar", "disabled");
                        if (reason) {
                          runAction(() => disableCredentialAction(credential.id, reason));
                        }
                      }}
                      className="rounded-md border border-border bg-panel px-2 py-1 text-xs font-semibold text-muted transition hover:border-warning/50 hover:text-warning disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(() => markCredentialLostAction(credential.id))}
                      className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition hover:bg-warning/20 disabled:opacity-50"
                    >
                      Perdida
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(() => markCredentialStolenAction(credential.id))}
                      className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
                    >
                      Robada
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(() => markCredentialDamagedAction(credential.id))}
                      className="rounded-md border border-border bg-panel px-2 py-1 text-xs font-semibold text-muted transition hover:border-cyan/50 hover:text-cyan disabled:opacity-50"
                    >
                      Dañada
                    </button>
                    <button
                      type="button"
                      disabled={isPending || accessDevices.length === 0}
                      onClick={() => {
                        const reason = window.prompt("Motivo de reemplazo", "damaged");
                        if (reason) {
                          runAction(() =>
                            replaceCredentialStartAction({
                              credentialId: credential.id,
                              reason,
                              ...(readerId ? { accessDeviceId: readerId } : {})
                            })
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-xs font-semibold text-cyan transition hover:bg-cyan/20 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Reemplazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Asignar RFID" description="Captura manual o desde lector simulado">
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-panel2/64 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Plus className="h-4 w-4 text-cyan" aria-hidden="true" />
                Captura manual
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={manualLabel}
                  onChange={(event) => setManualLabel(event.target.value)}
                  className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
                  placeholder="Etiqueta"
                />
                <input
                  value={manualTag}
                  onChange={(event) => setManualTag(event.target.value)}
                  className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
                  placeholder="idTag RFID"
                />
                <p className="text-xs leading-5 text-muted">
                  El valor completo no se mostrará después de guardar.
                </p>
                <button
                  type="button"
                  disabled={isPending || manualTag.trim().length < 4}
                  onClick={() =>
                    runAction(() =>
                      createManualRfidCredentialAction({
                        residentId: resident.id,
                        rawIdTag: manualTag,
                        label: manualLabel
                      })
                    )
                  }
                  className="min-h-10 rounded-md border border-success/40 bg-success/12 px-3 text-sm font-semibold text-success transition hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar RFID
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-panel2/64 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <RadioTower className="h-4 w-4 text-cyan" aria-hidden="true" />
                Captura desde lector
              </div>
              <div className="mt-4 grid gap-3">
                <select
                  value={readerId}
                  onChange={(event) => setReaderId(event.target.value)}
                  className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
                >
                  {accessDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isPending || !readerId}
                  onClick={() =>
                    runAction(async () => {
                      const result = await startCredentialEnrollmentAction({
                        residentId: resident.id,
                        mode: "assign",
                        accessDeviceId: readerId
                      });

                      if (result.ok && result.enrollmentId) {
                        setEnrollmentId(result.enrollmentId);
                        setEnrollmentStatus("waiting");
                        setCapturedMaskedValue(null);
                      }

                      return result;
                    })
                  }
                  className="min-h-10 rounded-md border border-cyan/40 bg-cyan/12 px-3 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Iniciar captura
                </button>

                {enrollmentId ? (
                  <div className="rounded-md border border-border bg-panel p-3 text-sm leading-6 text-muted">
                    <p className="font-semibold text-foreground">
                      {enrollmentStatus === "captured"
                        ? "Tarjeta asignada correctamente"
                        : enrollmentStatus === "expired"
                          ? "Tiempo expirado"
                          : "Esperando tarjeta..."}
                    </p>
                    {capturedMaskedValue ? <p className="mt-1">{capturedMaskedValue}</p> : null}
                    {enrollmentStatus === "waiting" ? (
                      <button
                        type="button"
                        onClick={() => runAction(() => cancelCredentialEnrollmentAction(enrollmentId))}
                        className="mt-3 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted transition hover:border-warning/50 hover:text-warning"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {message ? (
              <div className="rounded-md border border-border bg-panel/70 p-3 text-sm leading-6 text-muted">
                {message}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Sesiones recientes" description="Datos de sesión por toma">
          {sessions.length === 0 ? (
            <EmptyState title="Sin sesiones" description="Este residente aún no tiene sesiones registradas." />
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 6).map((session) => (
                <a
                  key={session.id}
                  href={`${basePath}/sessions/${session.id}`}
                  className="block rounded-lg border border-border bg-panel2/64 p-3 transition hover:border-cyan/50"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{session.chargerCode}</p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {formatKwh(session.deliveredKwh)} · {formatDuration(session.durationMinutes)}
                      </p>
                    </div>
                    <StatusBadge variant={session.status}>{session.statusLabel}</StatusBadge>
                  </div>
                </a>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Historial RFID" description="Eventos de credenciales y autorizaciones">
          {credentialEvents.length === 0 ? (
            <EmptyState title="Sin eventos" description="No hay historial RFID para este residente." />
          ) : (
            <div className="space-y-3">
              {credentialEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border bg-panel2/64 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-cyan">
                      {event.action.includes("marked") || event.action.includes("disabled") ? (
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{event.action}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {formatDateTime(event.createdAt)}
                        {event.reason ? ` · ${event.reason}` : ""}
                        {event.performedBy ? ` · ${event.performedBy}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function credentialStatusVariant(status: RfidCredentialSummary["status"]) {
  if (status === "active") {
    return "success";
  }

  if (status === "lost" || status === "stolen") {
    return "critical";
  }

  if (status === "damaged" || status === "pending_enrollment") {
    return "warning";
  }

  return "acknowledged";
}
