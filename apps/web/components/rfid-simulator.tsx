"use client";

import { RadioTower, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { SectionCard, StatCard, StatusBadge } from "@voltaria/ui";
import type { AccessDeviceSummary, ControlledOutletSummary } from "@voltaria/shared";

type RfidSimulatorProps = {
  accessDevices: AccessDeviceSummary[];
  outlets: ControlledOutletSummary[];
};

type RfidResponse = {
  result?: "captured" | "accepted" | "rejected" | "blocked";
  reason?: string;
  maskedValue?: string;
  sessionId?: string;
  commandId?: string;
  message?: string;
};

const quickTags = ["RFID-DEMO-1204", "RFID-DEMO-0802", "RFID-UNKNOWN"];

export function RfidSimulator({ accessDevices, outlets }: RfidSimulatorProps) {
  const [readerCode, setReaderCode] = useState(accessDevices[0]?.code ?? "RFID-PANEL-P1");
  const [outletPublicCode, setOutletPublicCode] = useState(outlets[0]?.publicAccessCode ?? "");
  const [idTag, setIdTag] = useState("RFID-DEMO-1204");
  const [response, setResponse] = useState<RfidResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedOutlet = useMemo(
    () => outlets.find((outlet) => outlet.publicAccessCode === outletPublicCode),
    [outletPublicCode, outlets]
  );

  const simulateTap = () => {
    startTransition(() => {
      void (async () => {
        const result = await fetch("/api/rfid/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            readerCode,
            outletPublicCode,
            idTag
          })
        });
        const json = (await result.json()) as RfidResponse;
        setResponse(json);
      })();
    });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="RFID Simulator" value="Dev tool" delta="Herramienta de desarrollo para simular lector RFID" tone="cyan" icon={<RadioTower className="h-5 w-5" aria-hidden="true" />} />
        <StatCard title="Lector" value={readerCode} delta="No usa hardware real" tone="primary" />
        <StatCard title="Toma" value={selectedOutlet?.code ?? "Sin toma"} delta={selectedOutlet?.location ?? "Selecciona una toma"} tone="success" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Simular tap" description="Envía un evento al endpoint RFID local">
          <div className="space-y-4">
            <label className="grid gap-2 text-sm text-muted">
              Lector
              <select
                value={readerCode}
                onChange={(event) => setReaderCode(event.target.value)}
                className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
              >
                {accessDevices.map((device) => (
                  <option key={device.id} value={device.code}>
                    {device.name} · {device.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-muted">
              Toma
              <select
                value={outletPublicCode}
                onChange={(event) => setOutletPublicCode(event.target.value)}
                className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
              >
                {outlets.length === 0 ? <option value="">Sin tomas disponibles</option> : null}
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.publicAccessCode}>
                    {outlet.code} · {outlet.location}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-muted">
              idTag demo
              <input
                value={idTag}
                onChange={(event) => setIdTag(event.target.value)}
                className="min-h-10 rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-cyan"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setIdTag(tag)}
                  className="rounded-md border border-border bg-panel2 px-2 py-1 text-xs font-semibold text-muted transition hover:border-cyan/50 hover:text-cyan"
                >
                  {tag}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isPending || idTag.trim().length < 4 || outletPublicCode.length === 0}
              onClick={simulateTap}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-cyan/40 bg-cyan/12 px-4 text-sm font-semibold text-cyan transition hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isPending ? "Enviando..." : "Simular tap"}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Respuesta"
          description="No se muestra hash ni secretos"
          action={response?.result ? <StatusBadge variant={resultVariant(response.result)}>{response.result}</StatusBadge> : undefined}
        >
          {response ? (
            <div className="grid gap-3">
              <ResponseRow label="Mensaje" value={response.message ?? "Sin mensaje"} />
              <ResponseRow label="Reason" value={response.reason ?? "n/a"} />
              <ResponseRow label="Tarjeta" value={response.maskedValue ?? "n/a"} />
              <ResponseRow label="Session" value={response.sessionId ?? "n/a"} />
              <ResponseRow label="Command" value={response.commandId ?? "n/a"} />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-panel2/64 p-5 text-sm leading-6 text-muted">
              Simula un tap para ver si el evento queda accepted, rejected, captured o blocked.
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function ResponseRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-panel2/64 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function resultVariant(result: NonNullable<RfidResponse["result"]>) {
  if (result === "accepted" || result === "captured") {
    return "success";
  }

  if (result === "blocked") {
    return "critical";
  }

  return "warning";
}
