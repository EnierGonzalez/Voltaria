import { NextResponse } from "next/server";
import { createDbClient, handleRfidTap, loadDatabaseEnv } from "@voltaria/db";
import { rfidReaderEventSchema } from "@voltaria/shared";

loadDatabaseEnv();

let warnedMissingReaderKey = false;

export async function POST(request: Request) {
  const configuredKey = process.env.RFID_READER_API_KEY?.trim();

  if (configuredKey && request.headers.get("x-voltaria-reader-key") !== configuredKey) {
    return NextResponse.json(
      { result: "rejected", reason: "invalid_reader_key", message: "Reader key inválida." },
      { status: 401 }
    );
  }

  if (!configuredKey && !warnedMissingReaderKey) {
    warnedMissingReaderKey = true;
    console.warn("RFID_READER_API_KEY is not configured; accepting local RFID simulator requests.");
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { result: "rejected", reason: "invalid_json", message: "JSON inválido." },
      { status: 400 }
    );
  }

  const parsed = rfidReaderEventSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { result: "rejected", reason: "invalid_payload", message: "Payload inválido." },
      { status: 400 }
    );
  }

  let context: ReturnType<typeof createDbClient> | null = null;

  try {
    context = createDbClient();
    const result = await handleRfidTap(context.db, {
      readerCode: parsed.data.readerCode,
      rawIdTag: parsed.data.idTag,
      source: "simulator",
      ...(parsed.data.outletPublicCode ? { outletPublicCode: parsed.data.outletPublicCode } : {}),
      ...(parsed.data.outletId ? { outletId: parsed.data.outletId } : {})
    });

    return NextResponse.json(result, { status: statusForResult(result.reason, result.result) });
  } catch {
    return NextResponse.json(
      { result: "rejected", reason: "internal_error", message: "No se pudo procesar el evento RFID." },
      { status: 500 }
    );
  } finally {
    await context?.client.end();
  }
}

function statusForResult(reason: string, result: string) {
  if (reason === "reader_not_found" || reason === "outlet_required") {
    return 404;
  }

  if (
    reason === "outlet_occupied" ||
    reason === "resident_has_active_session" ||
    reason === "credential_not_active"
  ) {
    return 409;
  }

  if (result === "rejected" || result === "blocked") {
    return 400;
  }

  return 200;
}
