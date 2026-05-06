import { sql } from "drizzle-orm";
import type { VoltariaDb } from "./client";

export async function pingDatabase(db: VoltariaDb) {
  await db.execute(sql`select 1`);
}
