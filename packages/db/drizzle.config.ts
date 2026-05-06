import { defineConfig } from "drizzle-kit";
import { assertDirectDatabaseUrl, getRequiredMigrationDatabaseUrl } from "./src/env";
import { loadDatabaseEnv } from "./src/load-env";

loadDatabaseEnv();

const databaseUrl = getRequiredMigrationDatabaseUrl();
assertDirectDatabaseUrl(databaseUrl);

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  },
  strict: true,
  verbose: true
});
