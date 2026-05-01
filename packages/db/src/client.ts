import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assertDirectDatabaseUrl, getDatabaseUrl, getRequiredDatabaseUrl } from "./env";
import * as schema from "./schema";

export type VoltariaDb = ReturnType<typeof createDbClient>["db"];

export function createDbClient(databaseUrl = getRequiredDatabaseUrl()) {
  assertDirectDatabaseUrl(databaseUrl);

  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false
  });

  return {
    client,
    db: drizzle(client, { schema })
  };
}

export function createDbClientIfConfigured() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  return createDbClient(databaseUrl);
}
