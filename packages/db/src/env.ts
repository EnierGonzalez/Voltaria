export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function hasRuntimeDatabaseUrl() {
  return Boolean(getRuntimeDatabaseUrl());
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  return value && value.length > 0 ? value : null;
}

export function getPooledDatabaseUrl() {
  const value = process.env.DATABASE_POOLED_URL?.trim();
  return value && value.length > 0 ? value : null;
}

export function getRuntimeDatabaseUrl() {
  return getPooledDatabaseUrl() ?? getDatabaseUrl();
}

export function getRequiredRuntimeDatabaseUrl() {
  const value = getRuntimeDatabaseUrl();

  if (!value) {
    throw new Error(
      "Database URL is not configured. Add DATABASE_POOLED_URL for runtime or DATABASE_URL for local development."
    );
  }

  assertValidDatabaseUrl(value, getPooledDatabaseUrl() ? "DATABASE_POOLED_URL" : "DATABASE_URL");
  return value;
}

export function getMigrationDatabaseUrl() {
  return getDatabaseUrl();
}

export function getRequiredMigrationDatabaseUrl() {
  const value = getDatabaseUrl();

  if (!value) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to .env or export it before running database commands."
    );
  }

  assertDirectDatabaseUrl(value, "DATABASE_URL");
  return value;
}

export function assertValidDatabaseUrl(databaseUrl: string, label = "DATABASE_URL") {
  try {
    new URL(databaseUrl);
  } catch {
    throw new Error(`${label} is invalid. Provide a valid PostgreSQL connection string.`);
  }
}

export function assertDirectDatabaseUrl(databaseUrl: string, label = "DATABASE_URL") {
  let hostname: string;

  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(`${label} is invalid. Provide a valid PostgreSQL connection string.`);
  }

  if (hostname.toLowerCase().includes("pooler")) {
    throw new Error(
      `${label} appears to use a pooled endpoint. Use the direct Neon PostgreSQL connection string for migrations and seed.`
    );
  }
}
