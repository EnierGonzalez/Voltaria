import { and, desc, eq, gte, lt, ne } from "drizzle-orm";
import type { VoltariaDb } from "./client";
import { auditSessionsForPeriod } from "./session-audit-service";
import {
  apartments,
  billingCycleItems,
  billingCycleSessionItems,
  billingCycles,
  chargers,
  chargingSessions,
  residents,
  sessionAudits
} from "./schema";

type AuditedSessionRow = Awaited<ReturnType<typeof getAuditedSessionsForPeriod>>[number];

export async function createBillingCycleDraft(
  db: VoltariaDb,
  propertyId: string,
  periodStart: Date,
  periodEnd: Date,
  createdBy = "admin"
) {
  await assertNoOpenCycleForPeriod(db, propertyId, periodStart, periodEnd);
  await auditSessionsForPeriod(db, propertyId, periodStart, periodEnd);

  const [cycle] = await db
    .insert(billingCycles)
    .values({
      propertyId,
      name: buildCycleName(periodStart, periodEnd),
      periodStart,
      periodEnd,
      status: "draft",
      createdBy,
      totalKwh: "0.000",
      totalAmount: "0.00",
      totalSessions: 0
    })
    .returning();

  if (!cycle) {
    throw new Error("No se pudo crear el corte.");
  }

  await rebuildBillingCycleItems(db, cycle.id);
  return getBillingCycleDetailRecord(db, cycle.id);
}

export async function recalculateBillingCycle(db: VoltariaDb, billingCycleId: string) {
  const cycle = await getBillingCycleRecord(db, billingCycleId);

  if (cycle.status === "closed") {
    throw new Error("Un corte cerrado no puede recalcularse.");
  }

  await auditSessionsForPeriod(db, cycle.propertyId, cycle.periodStart, cycle.periodEnd);
  await db
    .delete(billingCycleSessionItems)
    .where(eq(billingCycleSessionItems.billingCycleId, billingCycleId));
  await db.delete(billingCycleItems).where(eq(billingCycleItems.billingCycleId, billingCycleId));
  await rebuildBillingCycleItems(db, billingCycleId);

  return getBillingCycleDetailRecord(db, billingCycleId);
}

export async function approveBillingCycle(db: VoltariaDb, billingCycleId: string, approvedBy = "admin") {
  const cycle = await getBillingCycleRecord(db, billingCycleId);

  if (cycle.status === "closed") {
    throw new Error("Un corte cerrado no puede aprobarse.");
  }

  const [updated] = await db
    .update(billingCycles)
    .set({
      status: "approved",
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(billingCycles.id, billingCycleId))
    .returning();

  if (!updated) {
    throw new Error("No se pudo aprobar el corte.");
  }

  return updated;
}

export async function closeBillingCycle(db: VoltariaDb, billingCycleId: string) {
  const cycle = await getBillingCycleRecord(db, billingCycleId);

  if (cycle.status === "closed") {
    return cycle;
  }

  const [updated] = await db
    .update(billingCycles)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(billingCycles.id, billingCycleId))
    .returning();

  if (!updated) {
    throw new Error("No se pudo cerrar el corte.");
  }

  return updated;
}

export async function getBillingCycles(db: VoltariaDb, propertyId: string) {
  return db
    .select()
    .from(billingCycles)
    .where(eq(billingCycles.propertyId, propertyId))
    .orderBy(desc(billingCycles.periodStart));
}

export async function getBillingCycleDetail(db: VoltariaDb, billingCycleId: string) {
  return getBillingCycleDetailRecord(db, billingCycleId);
}

export async function getBillingCycleItems(db: VoltariaDb, billingCycleId: string) {
  return db
    .select()
    .from(billingCycleItems)
    .where(eq(billingCycleItems.billingCycleId, billingCycleId))
    .orderBy(billingCycleItems.createdAt);
}

export async function updateBillingCycleItemAdjustment(input: {
  db: VoltariaDb;
  itemId: string;
  adjustmentAmount: number;
  adjustmentReason: string;
}) {
  const [item] = await input.db
    .update(billingCycleItems)
    .set({
      adjustmentAmount: input.adjustmentAmount.toFixed(2),
      adjustmentReason: input.adjustmentReason,
      status: "adjusted",
      updatedAt: new Date()
    })
    .where(eq(billingCycleItems.id, input.itemId))
    .returning();

  if (!item) {
    throw new Error("Concepto de corte no encontrado.");
  }

  await refreshCycleTotals(input.db, item.billingCycleId);
  return item;
}

export async function excludeSessionFromCycle(input: {
  db: VoltariaDb;
  billingCycleId: string;
  sessionId: string;
  reason: string;
}) {
  const [sessionItem] = await input.db
    .update(billingCycleSessionItems)
    .set({
      included: false,
      billingStatus: "excluded",
      exclusionReason: input.reason
    })
    .where(
      and(
        eq(billingCycleSessionItems.billingCycleId, input.billingCycleId),
        eq(billingCycleSessionItems.sessionId, input.sessionId)
      )
    )
    .returning();

  if (!sessionItem) {
    throw new Error("Sesión no encontrada dentro del corte.");
  }

  await input.db
    .update(sessionAudits)
    .set({ billingStatus: "excluded", notes: input.reason, updatedAt: new Date() })
    .where(eq(sessionAudits.sessionId, input.sessionId));

  await refreshCycleTotals(input.db, input.billingCycleId);
  return sessionItem;
}

export async function includeSessionInCycle(input: {
  db: VoltariaDb;
  billingCycleId: string;
  sessionId: string;
}) {
  const [sessionItem] = await input.db
    .update(billingCycleSessionItems)
    .set({
      included: true,
      billingStatus: "billable",
      exclusionReason: null
    })
    .where(
      and(
        eq(billingCycleSessionItems.billingCycleId, input.billingCycleId),
        eq(billingCycleSessionItems.sessionId, input.sessionId)
      )
    )
    .returning();

  if (!sessionItem) {
    throw new Error("Sesión no encontrada dentro del corte.");
  }

  await input.db
    .update(sessionAudits)
    .set({ billingStatus: "billable", updatedAt: new Date() })
    .where(eq(sessionAudits.sessionId, input.sessionId));

  await refreshCycleTotals(input.db, input.billingCycleId);
  return sessionItem;
}

async function assertNoOpenCycleForPeriod(
  db: VoltariaDb,
  propertyId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const [existing] = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(
        eq(billingCycles.propertyId, propertyId),
        eq(billingCycles.periodStart, periodStart),
        eq(billingCycles.periodEnd, periodEnd),
        ne(billingCycles.status, "closed")
      )
    )
    .limit(1);

  if (existing) {
    throw new Error("Ya existe un corte abierto para ese periodo.");
  }
}

async function rebuildBillingCycleItems(db: VoltariaDb, billingCycleId: string) {
  const cycle = await getBillingCycleRecord(db, billingCycleId);
  const sessions = await getAuditedSessionsForPeriod(
    db,
    cycle.propertyId,
    cycle.periodStart,
    cycle.periodEnd
  );
  const groups = groupSessions(sessions);
  let totalKwh = 0;
  let totalAmount = 0;
  let totalSessions = 0;

  for (const group of groups.values()) {
    const billableSessions = group.sessions.filter((session) => session.included);
    const itemKwh = billableSessions.reduce((sum, session) => sum + session.energyKwh, 0);
    const itemAmount = billableSessions.reduce((sum, session) => sum + session.amount, 0);
    const validSessions = group.sessions.filter((session) => session.auditStatus === "valid").length;
    const warningSessions = group.sessions.filter((session) => session.auditStatus !== "valid").length;
    const excludedSessions = group.sessions.filter((session) => !session.included).length;

    const [item] = await db
      .insert(billingCycleItems)
      .values({
        billingCycleId,
        propertyId: cycle.propertyId,
        residentId: group.residentId,
        apartmentId: group.apartmentId,
        totalKwh: itemKwh.toFixed(3),
        totalAmount: itemAmount.toFixed(2),
        totalSessions: group.sessions.length,
        validSessions,
        warningSessions,
        excludedSessions,
        status: "draft"
      })
      .returning();

    if (!item) {
      throw new Error("No se pudo crear un concepto del corte.");
    }

    await db.insert(billingCycleSessionItems).values(
      group.sessions.map((session) => ({
        billingCycleId,
        billingCycleItemId: item.id,
        sessionId: session.sessionId,
        propertyId: cycle.propertyId,
        residentId: session.residentId,
        apartmentId: session.apartmentId,
        energyDeliveredKwh: session.energyKwh.toFixed(3),
        amount: session.amount.toFixed(2),
        auditStatus: session.auditStatus,
        billingStatus: session.billingStatus,
        included: session.included,
        ...(session.included ? {} : { exclusionReason: "Sesión no cobrable o pendiente de revisión" })
      }))
    );

    totalKwh += itemKwh;
    totalAmount += itemAmount;
    totalSessions += group.sessions.length;
  }

  await db
    .update(billingCycles)
    .set({
      totalKwh: totalKwh.toFixed(3),
      totalAmount: totalAmount.toFixed(2),
      totalSessions,
      updatedAt: new Date()
    })
    .where(eq(billingCycles.id, billingCycleId));
}

async function refreshCycleTotals(db: VoltariaDb, billingCycleId: string) {
  const rows = await db
    .select({
      itemId: billingCycleItems.id,
      totalAmount: billingCycleItems.totalAmount,
      adjustmentAmount: billingCycleItems.adjustmentAmount,
      totalKwh: billingCycleItems.totalKwh,
      totalSessions: billingCycleItems.totalSessions
    })
    .from(billingCycleItems)
    .where(eq(billingCycleItems.billingCycleId, billingCycleId));

  const totalAmount = rows.reduce(
    (sum, row) => sum + toNumber(row.totalAmount) + toNumber(row.adjustmentAmount),
    0
  );
  const totalKwh = rows.reduce((sum, row) => sum + toNumber(row.totalKwh), 0);
  const totalSessions = rows.reduce((sum, row) => sum + row.totalSessions, 0);

  await db
    .update(billingCycles)
    .set({
      totalAmount: totalAmount.toFixed(2),
      totalKwh: totalKwh.toFixed(3),
      totalSessions,
      updatedAt: new Date()
    })
    .where(eq(billingCycles.id, billingCycleId));
}

async function getBillingCycleRecord(db: VoltariaDb, billingCycleId: string) {
  const [cycle] = await db
    .select()
    .from(billingCycles)
    .where(eq(billingCycles.id, billingCycleId))
    .limit(1);

  if (!cycle) {
    throw new Error("Corte no encontrado.");
  }

  return cycle;
}

async function getBillingCycleDetailRecord(db: VoltariaDb, billingCycleId: string) {
  const cycle = await getBillingCycleRecord(db, billingCycleId);
  const items = await db
    .select()
    .from(billingCycleItems)
    .where(eq(billingCycleItems.billingCycleId, billingCycleId))
    .orderBy(billingCycleItems.createdAt);
  const sessions = await db
    .select()
    .from(billingCycleSessionItems)
    .where(eq(billingCycleSessionItems.billingCycleId, billingCycleId))
    .orderBy(billingCycleSessionItems.createdAt);

  return { cycle, items, sessions };
}

async function getAuditedSessionsForPeriod(
  db: VoltariaDb,
  propertyId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return db
    .select({
      sessionId: chargingSessions.id,
      propertyId: chargingSessions.propertyId,
      residentId: chargingSessions.residentId,
      apartmentId: chargingSessions.apartmentId,
      outletId: chargingSessions.chargerId,
      energyKwh: chargingSessions.energyKwh,
      amount: chargingSessions.costAmount,
      startedAt: chargingSessions.startedAt,
      auditStatus: sessionAudits.auditStatus,
      billingStatus: sessionAudits.billingStatus,
      apartmentNumber: apartments.number,
      residentName: residents.fullName,
      outletCode: chargers.ocppIdentity
    })
    .from(chargingSessions)
    .innerJoin(sessionAudits, eq(sessionAudits.sessionId, chargingSessions.id))
    .leftJoin(apartments, eq(apartments.id, chargingSessions.apartmentId))
    .leftJoin(residents, eq(residents.id, chargingSessions.residentId))
    .innerJoin(chargers, eq(chargers.id, chargingSessions.chargerId))
    .where(
      and(
        eq(chargingSessions.propertyId, propertyId),
        gte(chargingSessions.startedAt, periodStart),
        lt(chargingSessions.startedAt, periodEnd)
      )
    )
    .orderBy(chargingSessions.startedAt);
}

function groupSessions(rows: AuditedSessionRow[]) {
  const groups = new Map<
    string,
    {
      apartmentId: string;
      residentId: string | null;
      sessions: Array<{
        sessionId: string;
        residentId: string | null;
        apartmentId: string;
        energyKwh: number;
        amount: number;
        auditStatus: AuditedSessionRow["auditStatus"];
        billingStatus: AuditedSessionRow["billingStatus"];
        included: boolean;
      }>;
    }
  >();

  for (const row of rows) {
    if (!row.apartmentId) {
      continue;
    }

    const key = `${row.apartmentId}:${row.residentId ?? "sin_residente"}`;
    const group = groups.get(key) ?? {
      apartmentId: row.apartmentId,
      residentId: row.residentId,
      sessions: []
    };

    group.sessions.push({
      sessionId: row.sessionId,
      residentId: row.residentId,
      apartmentId: row.apartmentId,
      energyKwh: toNumber(row.energyKwh),
      amount: toNumber(row.amount),
      auditStatus: row.auditStatus,
      billingStatus: row.billingStatus,
      included: row.billingStatus === "billable"
    });

    groups.set(key, group);
  }

  return groups;
}

function buildCycleName(periodStart: Date, periodEnd: Date) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric"
  });

  return `Corte ${formatter.format(periodStart)} (${periodStart.toISOString().slice(0, 10)} a ${periodEnd.toISOString().slice(0, 10)})`;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}
