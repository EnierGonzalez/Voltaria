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
  const secret = process.env.RFID_HASH_SECRET?.trim() || DEV_RFID_HASH_SECRET;

  if (secret === DEV_RFID_HASH_SECRET && !warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn("RFID_HASH_SECRET is not configured; using development RFID hashing fallback.");
  }

  return createHmac("sha256", secret).update(normalized).digest("hex");
}
