import { defineConfig } from "drizzle-kit";
import { assertDirectDatabaseUrl, getRequiredDatabaseUrl } from "./src/env";
import { loadDatabaseEnv } from "./src/load-env";

loadDatabaseEnv();

const databaseUrl = getRequiredDatabaseUrl();
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
