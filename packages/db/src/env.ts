export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  return value && value.length > 0 ? value : null;
}

export function getRequiredDatabaseUrl() {
  const value = getDatabaseUrl();

  if (!value) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to .env or export it before running database commands."
    );
  }

  return value;
}

export function assertDirectDatabaseUrl(databaseUrl: string) {
  let hostname: string;

  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("DATABASE_URL is invalid. Provide a valid PostgreSQL connection string.");
  }

  if (hostname.toLowerCase().includes("pooler")) {
    throw new Error(
      "DATABASE_URL appears to use a pooled endpoint. Use the direct Neon PostgreSQL connection string for migrations and seed."
    );
  }
}
