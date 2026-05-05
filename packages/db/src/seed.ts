import { eq } from "drizzle-orm";
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
import {
  alerts,
  apartments,
  billingRecords,
  chargerConnectors,
  chargers,
  chargingSessions,
  deviceCommands,
  meterValues,
  ocppMessages,
  properties,
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
    await db.delete(ocppMessages).where(eq(ocppMessages.propertyId, existingProperty.id));
    await db.delete(systemEvents).where(eq(systemEvents.propertyId, existingProperty.id));
    await db.delete(properties).where(eq(properties.id, existingProperty.id));
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
    await db.insert(residentCredentials).values({
      residentId: primaryResident.id,
      providerKey: "local-rfid",
      providerSubject: "rfid:torre-aurora:1204:primary",
      credentialType: "rfid",
      passwordHash: "dev-only-rfid-hash-not-a-real-token",
      metadata: {
        label: "Tarjeta RFID principal",
        maskedValue: "****A91F",
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
