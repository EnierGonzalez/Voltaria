import { and, eq } from "drizzle-orm";
import {
  billingRecords as mockBillingRecords,
  chargingPoints,
  meterValueSeries,
  mobileSessions,
  ocppLogs,
  recentAlerts,
  residents as mockResidents,
  sessionEvents,
  tariffs as mockTariffs,
  towerOutlets
} from "@voltaria/shared";
import { createDbClient } from "./client";
import { loadDatabaseEnv } from "./load-env";
import { hashRfidTag, maskRfidTag } from "./rfid-utils";
import {
  accessDevices,
  accessScheduleWindows,
  alerts,
  apartments,
  billingRecords,
  chargerConnectors,
  chargers,
  chargingSessions,
  deviceCommands,
  meterValues,
  ocppMessages,
  outletAccessOverrides,
  properties,
  propertyAccessRules,
  residentCredentials,
  residents,
  systemEvents,
  tariffs
} from "./schema";

loadDatabaseEnv();

const propertySeed = {
  name: "Torre Aurora",
  slug: "torre-aurora",
  address: "Av. Bonampak 110, Cancún",
  timezone: "America/Cancun",
  billingCurrency: "MXN"
};

const { db, client } = createDbClient();

try {
  await seed();
  console.info("Seed completed for property torre-aurora.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
} finally {
  await client.end();
}

async function seed() {
  const [existingProperty] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, propertySeed.slug))
    .limit(1);

  if (existingProperty) {
    const [property] = await db
      .update(properties)
      .set({ ...propertySeed, updatedAt: new Date() })
      .where(eq(properties.id, existingProperty.id))
      .returning();

    if (!property) {
      throw new Error("Seed failed while updating property.");
    }

    await ensureRfidSeed(property.id);
    await ensureOperationalRulesSeed(property.id);
    return;
  }

  const [property] = await db.insert(properties).values(propertySeed).returning();

  if (!property) {
    throw new Error("Seed failed while creating property.");
  }

  const apartmentRows = await db
    .insert(apartments)
    .values(
      ["1204", "0802", "1501", "0306"].map((number) => ({
        propertyId: property.id,
        tower: "Aurora",
        number,
        floor: Number(number.slice(0, 2))
      }))
    )
    .returning();

  const apartmentsByNumber = new Map(apartmentRows.map((apartment) => [apartment.number, apartment]));

  const residentRows = await db
    .insert(residents)
    .values(
      mockResidents.map((resident) => ({
        propertyId: property.id,
        apartmentId: apartmentsByNumber.get(resident.apartmentNumber)?.id,
        fullName: resident.name,
        email: resident.email,
        isActive: resident.accessStatus === "success"
      }))
    )
    .returning();

  await db.insert(residentCredentials).values(
    residentRows.map((resident) => ({
      propertyId: property.id,
      residentId: resident.id,
      providerKey: "local",
      providerSubject: resident.email,
      credentialType: "passwordless",
      metadata: {
        seeded: true
      }
    }))
  );

  const residentsByName = new Map(residentRows.map((resident) => [resident.fullName, resident]));
  const primaryResident = residentsByName.get("María López") ?? residentRows[0];

  if (primaryResident) {
    const demoRfidTag = "RFID-DEMO-1204";
    const hashedValue = hashRfidTag(demoRfidTag);
    const maskedValue = maskRfidTag(demoRfidTag);

    await db.insert(residentCredentials).values({
      propertyId: property.id,
      residentId: primaryResident.id,
      providerKey: "rfid",
      providerSubject: `rfid:${hashedValue}`,
      credentialType: "rfid",
      label: "Tarjeta principal",
      hashedValue,
      maskedValue,
      status: "active",
      metadata: {
        label: "Tarjeta RFID principal",
        maskedValue,
        status: "active",
        seeded: true
      }
    });
  }

  const carlosResident = residentsByName.get("Carlos Méndez");

  if (carlosResident) {
    const demoRfidTag = "RFID-DEMO-0802";
    const hashedValue = hashRfidTag(demoRfidTag);
    const maskedValue = maskRfidTag(demoRfidTag);

    await db.insert(residentCredentials).values({
      propertyId: property.id,
      residentId: carlosResident.id,
      providerKey: "rfid",
      providerSubject: `rfid:${hashedValue}`,
      credentialType: "rfid",
      label: "Tarjeta secundaria",
      hashedValue,
      maskedValue,
      status: "active",
      metadata: {
        label: "Tarjeta secundaria",
        maskedValue,
        status: "active",
        seeded: true
      }
    });
  }

  const chargerRows = await db
    .insert(chargers)
    .values(
      chargingPoints.map((charger) => ({
        propertyId: property.id,
        kind: charger.kind,
        ocppIdentity: charger.code,
        name: charger.name,
        location: charger.location,
        vendor: charger.kind === "controlled_outlet" ? "Voltaria Sim" : "Voltaria",
        model: charger.kind === "controlled_outlet" ? "120V Controlled Outlet" : "AC Wallbox",
        serialNumber: charger.id,
        firmwareVersion: "1.6J-mock",
        status: charger.status,
        voltage: charger.voltage,
        maxCurrentAmp: charger.maxCurrentAmp?.toFixed(2),
        maxPowerKw: charger.maxPowerKw.toFixed(2),
        publicAccessCode: charger.publicAccessCode,
        controlMode: charger.controlMode ?? "simulated",
        lastHeartbeatAt: new Date(charger.lastSeenAt)
      }))
    )
    .returning();

  const chargersByCode = new Map(chargerRows.map((charger) => [charger.ocppIdentity, charger]));
  const linkedOutlet = chargersByCode.get("AUR-TOMA-01");

  await db.insert(accessDevices).values({
    propertyId: property.id,
    code: "RFID-PANEL-P1",
    name: "Panel RFID Nivel P1",
    kind: "rfid_kiosk",
    locationLabel: "Nivel P1",
    linkedOutletId: linkedOutlet?.id,
    status: "online",
    lastSeenAt: new Date(),
    metadata: { simulated: true, seeded: true }
  });

  const connectorRows = await db
    .insert(chargerConnectors)
    .values(
      chargingPoints.flatMap((charger) => {
        const chargerRow = chargersByCode.get(charger.code);

        if (!chargerRow) {
          return [];
        }

        return Array.from({ length: charger.connectors }, (_, index) => ({
          propertyId: property.id,
          chargerId: chargerRow.id,
          connectorNumber: index + 1,
          status: connectorStatusFor(charger.status),
          maxPowerKw: charger.maxPowerKw.toFixed(2),
          lastStatusAt: new Date(charger.lastSeenAt)
        }));
      })
    )
    .returning();

  const connectorsByChargerAndNumber = new Map(
    connectorRows.map((connector) => [
      `${connector.chargerId}:${connector.connectorNumber}`,
      connector
    ])
  );

  const [tariff] = await db
    .insert(tariffs)
    .values({
      propertyId: property.id,
      name: mockTariffs[0]?.name ?? "Residencial mayo",
      ratePerKwh: (mockTariffs[0]?.ratePerKwh ?? 5.5).toFixed(4),
      currency: mockTariffs[0]?.currency ?? "MXN",
      validFrom: new Date("2026-05-01T00:00:00-05:00"),
      isActive: true
    })
    .returning();

  if (!tariff) {
    throw new Error("Seed failed while creating tariff.");
  }

  const sessionRows = await db
    .insert(chargingSessions)
    .values(
      mobileSessions.map((session, index) => {
        const charger = chargersByCode.get(session.chargerCode);
        const resident = residentsByName.get(session.residentName);
        const apartment = apartmentsByNumber.get(session.apartmentNumber);
        const connector = charger
          ? connectorsByChargerAndNumber.get(`${charger.id}:${session.connectorNumber}`)
          : undefined;
        const meterStartWh = 180000 + index * 6000;
        const meterStopWh = meterStartWh + Math.round(session.deliveredKwh * 1000);

        if (!charger) {
          throw new Error(`Seed charger not found for session ${session.id}.`);
        }

        return {
          propertyId: property.id,
          chargerId: charger.id,
          connectorId: connector?.id,
          residentId: resident?.id,
          apartmentId: apartment?.id,
          ocppTransactionId: 88000 + index,
          status: session.status,
          startedAt: new Date(session.startedAt),
          endedAt: session.endedAt ? new Date(session.endedAt) : null,
          meterStartWh,
          meterStopWh,
          energyKwh: session.deliveredKwh.toFixed(3),
          peakPowerKw: session.powerKw.toFixed(2),
          averagePowerKw: session.powerKw.toFixed(2),
          costAmount: session.costAmount.toFixed(2),
          currency: "MXN",
          stopReason: session.status === "failed" ? "Faulted" : null
        };
      })
    )
    .returning();

  const sessionsByMockId = new Map(mobileSessions.map((session, index) => [session.id, sessionRows[index]]));

  await db.insert(meterValues).values(
    Object.entries(meterValueSeries).flatMap(([mockSessionId, values]) => {
      const session = sessionsByMockId.get(mockSessionId);

      if (!session) {
        return [];
      }

      return values.map((value) => ({
        propertyId: property.id,
        sessionId: session.id,
        chargerId: session.chargerId,
        connectorId: session.connectorId,
        sampledAt: new Date(value.sampledAt),
        energyWh: Math.round(value.energyKwh * 1000),
        powerW: Math.round(value.powerKw * 1000),
        rawPayload: {
          sampledAt: value.sampledAt,
          energyKwh: value.energyKwh,
          powerKw: value.powerKw
        }
      }));
    })
  );

  await db.insert(alerts).values(
    recentAlerts.map((alert) => {
      const charger = alert.chargerId
        ? chargerRows.find((item) => item.serialNumber === alert.chargerId)
        : undefined;
      const session = alert.sessionId ? sessionsByMockId.get(alert.sessionId) : undefined;

      return {
        propertyId: property.id,
        chargerId: charger?.id,
        sessionId: session?.id,
        severity: alert.severity,
        status: "open" as const,
        title: alert.title,
        description: alert.description,
        source: alert.source
      };
    })
  );

  await db.insert(billingRecords).values(
    mockBillingRecords.map((record) => {
      const resident = residentsByName.get(record.residentName);
      const apartment = apartmentsByNumber.get(record.apartmentNumber);

      return {
        propertyId: property.id,
        residentId: resident?.id,
        apartmentId: apartment?.id,
        tariffId: tariff.id,
        periodStart: record.period.startsWith("Abril")
          ? new Date("2026-04-01T00:00:00-05:00")
          : new Date("2026-05-01T00:00:00-05:00"),
        periodEnd: record.period.startsWith("Abril")
          ? new Date("2026-04-30T23:59:59-05:00")
          : new Date("2026-05-31T23:59:59-05:00"),
        energyKwh: record.kwh.toFixed(3),
        ratePerKwh: record.ratePerKwh.toFixed(4),
        subtotalAmount: record.totalAmount.toFixed(2),
        taxAmount: "0.00",
        totalAmount: record.totalAmount.toFixed(2),
        currency: "MXN",
        status: record.status
      };
    })
  );

  await db.insert(ocppMessages).values(
    ocppLogs.flatMap((log) => {
      const charger = chargerRows.find((item) => item.serialNumber === log.chargerId);
      const session = log.sessionId ? sessionsByMockId.get(log.sessionId) : undefined;

      if (!charger) {
        return [];
      }

      return [
        {
          propertyId: property.id,
          chargerId: charger.id,
          direction: log.direction,
          messageTypeId: log.messageTypeId,
          uniqueId: log.uniqueId,
          action: log.action,
          payload: {
            sessionId: session?.id,
            summary: log.payloadSummary
          },
          rawMessage: {
            direction: log.direction,
            action: log.action,
            summary: log.payloadSummary
          },
          receivedAt: new Date(log.createdAt)
        }
      ];
    })
  );

  await db.insert(systemEvents).values(
    sessionEvents.flatMap((event) => {
      const session = sessionsByMockId.get(event.sessionId);

      if (!session) {
        return [];
      }

      return [
        {
          propertyId: property.id,
          chargerId: session.chargerId,
          sessionId: session.id,
          severity: event.tone === "success" ? "info" : event.tone,
          eventType: event.label,
          message: event.description,
          metadata: {
            seeded: true
          },
          occurredAt: new Date(event.occurredAt)
        }
      ];
    })
  );

  await db.insert(deviceCommands).values(
    towerOutlets
      .filter((outlet) => outlet.status === "charging")
      .flatMap((outlet) => {
        const charger = chargersByCode.get(outlet.code);
        const session = mobileSessions.find((item) => item.chargerCode === outlet.code);
        const sessionRow = session ? sessionsByMockId.get(session.id) : undefined;

        if (!charger) {
          return [];
        }

        return [
          {
            propertyId: property.id,
            chargerId: charger.id,
            sessionId: sessionRow?.id,
            commandType: "enable" as const,
            status: "acknowledged" as const,
            payload: {
              adapter: "simulated",
              voltage: outlet.voltage,
              maxCurrentAmp: outlet.maxCurrentAmp
            },
            requestedBy: "seed:mobile",
            acknowledgedAt: new Date()
          }
        ];
      })
  );

  await ensureOperationalRulesSeed(property.id);
}

async function ensureRfidSeed(propertyId: string) {
  const [outlet] = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.propertyId, propertyId), eq(chargers.ocppIdentity, "AUR-TOMA-01")))
    .limit(1);

  const [reader] = await db
    .select()
    .from(accessDevices)
    .where(and(eq(accessDevices.propertyId, propertyId), eq(accessDevices.code, "RFID-PANEL-P1")))
    .limit(1);

  if (reader) {
    await db
      .update(accessDevices)
      .set({
        name: "Panel RFID Nivel P1",
        kind: "rfid_kiosk",
        locationLabel: "Nivel P1",
        linkedOutletId: outlet?.id,
        status: "online",
        updatedAt: new Date()
      })
      .where(eq(accessDevices.id, reader.id));
  } else {
    await db.insert(accessDevices).values({
      propertyId,
      code: "RFID-PANEL-P1",
      name: "Panel RFID Nivel P1",
      kind: "rfid_kiosk",
      locationLabel: "Nivel P1",
      linkedOutletId: outlet?.id,
      status: "online",
      lastSeenAt: new Date(),
      metadata: { simulated: true, seeded: true }
    });
  }

  await ensureDemoRfidCredential(propertyId, "María López", "RFID-DEMO-1204", "Tarjeta principal");
  await ensureDemoRfidCredential(propertyId, "Carlos Méndez", "RFID-DEMO-0802", "Tarjeta secundaria");
}

async function ensureOperationalRulesSeed(propertyId: string) {
  const [existingRule] = await db
    .select()
    .from(propertyAccessRules)
    .where(and(eq(propertyAccessRules.propertyId, propertyId), eq(propertyAccessRules.name, "Regla residencial estándar")))
    .limit(1);

  const values = {
    propertyId,
    name: "Regla residencial estándar",
    active: true,
    allowRfid: true,
    allowMobile: true,
    allowAdmin: true,
    maxActiveSessionsPerResident: 1,
    maxActiveSessionsPerApartment: 2,
    maxActiveSessionsProperty: 16,
    maxSessionDurationMinutes: 480,
    maxSessionKwh: null,
    maxSessionCost: null,
    startupNoLoadTimeoutSeconds: 90,
    noLoadTimeoutSeconds: 600,
    lowPowerThresholdWatts: "20.00",
    overcurrentAction: "stop_session" as const,
    defaultMaxCurrentAmp: "12.00",
    updatedAt: new Date()
  };
  const [rule] = existingRule
    ? await db
        .update(propertyAccessRules)
        .set(values)
        .where(eq(propertyAccessRules.id, existingRule.id))
        .returning()
    : await db.insert(propertyAccessRules).values(values).returning();

  if (!rule) {
    return;
  }

  await ensureDailyScheduleWindows(propertyId, rule.id, "00:00", "23:59");

  const [outlet16] = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.propertyId, propertyId), eq(chargers.ocppIdentity, "AUR-TOMA-16")))
    .limit(1);

  if (!outlet16) {
    return;
  }

  const [existingOverride] = await db
    .select()
    .from(outletAccessOverrides)
    .where(
      and(
        eq(outletAccessOverrides.propertyId, propertyId),
        eq(outletAccessOverrides.outletId, outlet16.id)
      )
    )
    .limit(1);

  const overrideValues = {
    propertyId,
    outletId: outlet16.id,
    status: "maintenance" as const,
    allowRfid: true,
    allowMobile: true,
    maxCurrentAmp: "12.00",
    maxSessionDurationMinutes: 480,
    notes: "Demo: toma en mantenimiento para validar denegación.",
    updatedAt: new Date()
  };

  if (existingOverride) {
    await db
      .update(outletAccessOverrides)
      .set(overrideValues)
      .where(eq(outletAccessOverrides.id, existingOverride.id));
  } else {
    await db.insert(outletAccessOverrides).values(overrideValues);
  }
}

async function ensureDailyScheduleWindows(
  propertyId: string,
  ruleId: string,
  startTime: string,
  endTime: string
) {
  const existingWindows = await db
    .select()
    .from(accessScheduleWindows)
    .where(and(eq(accessScheduleWindows.propertyId, propertyId), eq(accessScheduleWindows.ruleId, ruleId)));
  const usedIds = new Set<string>();

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const existing = existingWindows.find((window) => window.dayOfWeek === dayOfWeek && !usedIds.has(window.id));

    if (existing) {
      usedIds.add(existing.id);
      await db
        .update(accessScheduleWindows)
        .set({ startTime, endTime, active: true, updatedAt: new Date() })
        .where(eq(accessScheduleWindows.id, existing.id));
      continue;
    }

    const [created] = await db
      .insert(accessScheduleWindows)
      .values({ propertyId, ruleId, dayOfWeek, startTime, endTime, active: true })
      .returning({ id: accessScheduleWindows.id });

    if (created) {
      usedIds.add(created.id);
    }
  }

  for (const window of existingWindows) {
    if (!usedIds.has(window.id)) {
      await db
        .update(accessScheduleWindows)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(accessScheduleWindows.id, window.id));
    }
  }
}

async function ensureDemoRfidCredential(
  propertyId: string,
  residentName: string,
  rawIdTag: string,
  label: string
) {
  const [resident] = await db
    .select()
    .from(residents)
    .where(and(eq(residents.propertyId, propertyId), eq(residents.fullName, residentName)))
    .limit(1);

  if (!resident) {
    return;
  }

  const hashedValue = hashRfidTag(rawIdTag);
  const maskedValue = maskRfidTag(rawIdTag);
  const providerSubject = `rfid:${hashedValue}`;
  const [credential] = await db
    .select()
    .from(residentCredentials)
    .where(
      and(
        eq(residentCredentials.providerKey, "rfid"),
        eq(residentCredentials.providerSubject, providerSubject)
      )
    )
    .limit(1);

  if (credential) {
    await db
      .update(residentCredentials)
      .set({
        propertyId,
        residentId: resident.id,
        credentialType: "rfid",
        label,
        hashedValue,
        maskedValue,
        status: "active",
        updatedAt: new Date(),
        metadata: { label, maskedValue, status: "active", seeded: true }
      })
      .where(eq(residentCredentials.id, credential.id));
    return;
  }

  await db.insert(residentCredentials).values({
    propertyId,
    residentId: resident.id,
    providerKey: "rfid",
    providerSubject,
    credentialType: "rfid",
    label,
    hashedValue,
    maskedValue,
    status: "active",
    metadata: { label, maskedValue, status: "active", seeded: true }
  });
}

function connectorStatusFor(status: (typeof chargingPoints)[number]["status"]) {
  if (status === "charging") {
    return "charging" as const;
  }

  if (status === "faulted") {
    return "faulted" as const;
  }

  if (status === "offline") {
    return "unavailable" as const;
  }

  if (status === "reserved") {
    return "reserved" as const;
  }

  return "available" as const;
}
