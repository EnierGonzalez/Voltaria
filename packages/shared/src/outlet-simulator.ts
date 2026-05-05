import type {
  ActivationMethod,
  ChargingSessionSummary,
  ControlledOutletSummary,
  ResidentSummary,
  TariffSummary
} from "./types";

export type OutletSessionStartResult =
  | {
      ok: true;
      session: ChargingSessionSummary;
      command: {
        commandType: "enable";
        status: "acknowledged";
        payload: Record<string, unknown>;
      };
    }
  | {
      ok: false;
      reason: string;
    };

export const simulatedControlledOutletAdapter = {
  async enableOutlet(outletId: string) {
    return {
      outletId,
      status: "available" as const,
      acknowledged: true
    };
  },

  async disableOutlet(outletId: string) {
    return {
      outletId,
      status: "available" as const,
      acknowledged: true
    };
  },

  async getOutletStatus(outlet: ControlledOutletSummary) {
    return {
      outletId: outlet.id,
      status: outlet.status,
      powerKw: outlet.status === "charging" ? outlet.currentPowerKw : 0,
      noLoad: outlet.status === "charging" && outlet.currentPowerKw < 0.1,
      faulted: outlet.status === "faulted"
    };
  },

  generateMeterValues(outlet: ControlledOutletSummary, samples = 6) {
    const basePowerKw = outlet.status === "charging" ? outlet.currentPowerKw || 1.1 : 0;

    return Array.from({ length: samples }, (_, index) => {
      const simulatedPower = basePowerKw
        ? Math.max(0.8, Math.min(1.5, basePowerKw + (index % 3) * 0.08 - 0.08))
        : 0;

      return {
        label: `${index * 10} min`,
        powerKw: simulatedPower,
        energyKwh: Number(((simulatedPower * index * 10) / 60).toFixed(3)),
        voltage: 120,
        currentAmp: Number((simulatedPower * 1000 / 120).toFixed(2))
      };
    });
  }
};

export function startOutletSession({
  outlet,
  resident,
  activeSessions,
  tariff,
  method = "mobile"
}: {
  outlet: ControlledOutletSummary;
  resident: ResidentSummary;
  activeSessions: ChargingSessionSummary[];
  tariff?: TariffSummary;
  method?: ActivationMethod;
}): OutletSessionStartResult {
  if (resident.accessStatus !== "success") {
    return { ok: false, reason: "El residente no tiene acceso activo." };
  }

  if (!resident.apartmentNumber || resident.apartmentNumber === "Sin depto") {
    return { ok: false, reason: "El departamento no está activo." };
  }

  if (outlet.status !== "available") {
    return { ok: false, reason: "La toma no está disponible." };
  }

  const residentHasActiveSession = activeSessions.some(
    (session) =>
      session.residentName === resident.name &&
      (session.status === "active" || session.status === "pending_start")
  );

  if (residentHasActiveSession) {
    return { ok: false, reason: "Ya tienes una sesión activa." };
  }

  const outletHasActiveSession = activeSessions.some(
    (session) =>
      session.chargerId === outlet.id &&
      (session.status === "active" || session.status === "pending_start")
  );

  if (outletHasActiveSession) {
    return { ok: false, reason: "La toma ya tiene una sesión activa." };
  }

  if (!tariff) {
    return { ok: false, reason: "No hay una tarifa activa para iniciar la sesión." };
  }

  const now = new Date();

  return {
    ok: true,
    session: {
      id: `sim_${outlet.id}_${now.getTime()}`,
      propertyId: outlet.propertyId,
      chargerId: outlet.id,
      connectorNumber: 1,
      residentName: resident.name,
      apartmentNumber: resident.apartmentNumber,
      chargerCode: outlet.code,
      chargerLocation: outlet.location,
      deliveredKwh: 0,
      durationMinutes: 1,
      powerKw: 1.1,
      costAmount: 0,
      tariffName: tariff.name,
      ratePerKwh: tariff.ratePerKwh,
      status: "active",
      statusLabel: "Activa",
      activationMethod: method,
      startedAt: now.toISOString(),
      shortDate: "Hoy",
      dateLabel: "Ahora"
    },
    command: {
      commandType: "enable",
      status: "acknowledged",
      payload: {
        adapter: "simulated",
        outletId: outlet.id,
        publicAccessCode: outlet.publicAccessCode,
        noLoadTimeoutSeconds: 90,
        requestedBy: method
      }
    }
  };
}
