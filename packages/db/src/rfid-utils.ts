import { createHmac } from "node:crypto";

const DEV_RFID_HASH_SECRET = "voltaria-dev-rfid-hash-secret";
let warnedAboutDevSecret = false;

export function normalizeRfidTag(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateRfidTag(raw: string) {
  const normalized = normalizeRfidTag(raw);
  return /^[A-Z0-9:_-]{4,80}$/.test(normalized);
}

export function maskRfidTag(rawOrNormalized: string) {
  const normalized = normalizeRfidTag(rawOrNormalized);
  const visible = normalized.slice(-4);
  return `****${visible}`;
}

export function hashRfidTag(rawOrNormalized: string) {
  const normalized = normalizeRfidTag(rawOrNormalized);
  const configuredSecret = process.env.RFID_HASH_SECRET?.trim();
  const appEnv = process.env.APP_ENV?.trim() || "development";
  const insecureSecret =
    !configuredSecret ||
    configuredSecret === "change-me-before-real-cards" ||
    configuredSecret === "change-me-in-production";

  if (appEnv !== "development" && insecureSecret) {
    throw new Error("RFID_HASH_SECRET must be configured before using RFID outside development.");
  }

  const secret = insecureSecret ? DEV_RFID_HASH_SECRET : configuredSecret!;

  if (secret === DEV_RFID_HASH_SECRET && !warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn("RFID_HASH_SECRET is not configured; using development RFID hashing fallback.");
  }

  return createHmac("sha256", secret).update(normalized).digest("hex");
}
