import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";

const PASSWORD_PREFIX = "scrypt";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SESSION_TOKEN_BYTES = 32;
const DEFAULT_SESSION_HOURS = 12;
const DEV_SESSION_SECRET = "voltaria-dev-session-secret";

export const SESSION_COOKIE_NAME = "voltaria_session";

let warnedDevSessionSecret = false;

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await deriveScrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });

  return [PASSWORD_PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derived.toString("base64url")].join(
    "$"
  );
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const parts = storedHash.split("$");

  if (parts.length !== 6 || parts[0] !== PASSWORD_PREFIX) {
    return false;
  }

  const [, nRaw, rRaw, pRaw, salt, hash] = parts;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = await deriveScrypt(password, salt, expected.length, { N: n, r, p });

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("base64url");
}

export function getSessionCookieMaxAge() {
  const parsed = Number(process.env.AUTH_SESSION_HOURS ?? DEFAULT_SESSION_HOURS);
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_HOURS;
  return Math.round(hours * 60 * 60);
}

export function getSessionExpiryDate() {
  return new Date(Date.now() + getSessionCookieMaxAge() * 1000);
}

export function createSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.APP_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionCookieMaxAge()
  };
}

export function clearSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.APP_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  };
}

export function validatePasswordStrength(password: string) {
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  const appEnv = process.env.APP_ENV ?? "development";

  if (secret && secret !== "change-me") {
    return secret;
  }

  if (appEnv !== "development" && appEnv !== "test") {
    throw new Error("AUTH_SESSION_SECRET must be configured outside development.");
  }

  if (!warnedDevSessionSecret) {
    warnedDevSessionSecret = true;
    console.warn("AUTH_SESSION_SECRET is not configured; using development-only session secret.");
  }

  return DEV_SESSION_SECRET;
}

function deriveScrypt(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number }
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}
