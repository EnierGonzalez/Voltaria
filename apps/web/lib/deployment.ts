import { getRuntimeDatabaseUrl } from "@voltaria/db";

const placeholderSecrets = new Set([
  "change-me",
  "change-me-before-real-cards",
  "change-me-in-production",
  "dev-reader-key"
]);

export function getAppEnv() {
  return process.env.APP_ENV?.trim() || "development";
}

export function isDevelopmentEnv() {
  return getAppEnv() === "development";
}

export function isDemoToolsEnabled() {
  const explicit = process.env.ENABLE_DEMO_TOOLS?.trim().toLowerCase();

  if (explicit === "false") {
    return false;
  }

  if (explicit === "true") {
    return true;
  }

  return getAppEnv() !== "production";
}

export function hasSafeRfidHashSecret() {
  const value = process.env.RFID_HASH_SECRET?.trim();
  return Boolean(value && !placeholderSecrets.has(value));
}

export function hasReaderApiKey() {
  const value = process.env.RFID_READER_API_KEY?.trim();
  return Boolean(value && !placeholderSecrets.has(value));
}

export function hasAuthSessionSecret() {
  const value = process.env.AUTH_SESSION_SECRET?.trim();
  return Boolean(value && !placeholderSecrets.has(value));
}

export function getDeploymentConfigStatus() {
  const appEnv = getAppEnv();
  const stagingAccessEnabled = process.env.STAGING_ACCESS_ENABLED === "true";
  const stagingUsernameConfigured = Boolean(process.env.STAGING_ACCESS_USERNAME?.trim());
  const stagingPassword = process.env.STAGING_ACCESS_PASSWORD?.trim();
  const stagingPasswordConfigured = Boolean(
    stagingPassword && !placeholderSecrets.has(stagingPassword)
  );
  const rfidHashConfigured = hasSafeRfidHashSecret();
  const readerKeyConfigured = hasReaderApiKey();
  const authSessionSecretConfigured = hasAuthSessionSecret();
  const databaseConfigured = Boolean(getRuntimeDatabaseUrl());
  const issues: string[] = [];

  if (!databaseConfigured) {
    issues.push("database_url_missing");
  }

  if (appEnv !== "development" && !rfidHashConfigured) {
    issues.push("rfid_hash_secret_missing_or_placeholder");
  }

  if (appEnv !== "development" && !readerKeyConfigured) {
    issues.push("rfid_reader_api_key_missing_or_placeholder");
  }

  if (appEnv !== "development" && !authSessionSecretConfigured) {
    issues.push("auth_session_secret_missing_or_placeholder");
  }

  if (stagingAccessEnabled && (!stagingUsernameConfigured || !stagingPasswordConfigured)) {
    issues.push("staging_access_credentials_missing_or_placeholder");
  }

  return {
    status: issues.length === 0 ? "ok" : "error",
    appEnv,
    databaseConfigured,
    demoToolsEnabled: isDemoToolsEnabled(),
    rfidHashSecretConfigured: rfidHashConfigured,
    rfidReaderApiKeyConfigured: readerKeyConfigured,
    authSessionSecretConfigured,
    stagingAccessEnabled,
    stagingAccessConfigured: !stagingAccessEnabled || (stagingUsernameConfigured && stagingPasswordConfigured),
    vercelUrlConfigured: Boolean(process.env.VERCEL_URL?.trim()),
    issues
  };
}
