import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  assertDirectDatabaseUrl,
  assertValidDatabaseUrl,
  getMigrationDatabaseUrl,
  getRequiredMigrationDatabaseUrl,
  getRequiredRuntimeDatabaseUrl,
  getRuntimeDatabaseUrl
} from "./env";
import * as schema from "./schema";

export type VoltariaDb = ReturnType<typeof createDbClient>["db"];

export function createDbClient(databaseUrl = getRequiredRuntimeDatabaseUrl()) {
  assertValidDatabaseUrl(databaseUrl, "Runtime database URL");
  const isPooledRuntimeUrl = databaseUrl === getRuntimeDatabaseUrl() && Boolean(process.env.DATABASE_POOLED_URL?.trim());

  const client = postgres(databaseUrl, {
    max: isPooledRuntimeUrl ? 1 : 10,
    prepare: false
  });

  return {
    client,
    db: drizzle(client, { schema })
  };
}

export function createMigrationDbClient(databaseUrl = getRequiredMigrationDatabaseUrl()) {
  assertDirectDatabaseUrl(databaseUrl, "DATABASE_URL");
  return createDbClient(databaseUrl);
}

export function createDbClientIfConfigured() {
  const databaseUrl = getRuntimeDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  return createDbClient(databaseUrl);
}
