import { randomUUID } from "node:crypto";
import { WebSocketServer, type RawData } from "ws";
import type { OcppCall, OcppCallError, OcppCallResult, OcppMessage } from "@voltaria/shared";

const port = Number(process.env.OCPP_PORT ?? 9220);
const path = process.env.OCPP_PATH ?? "/ocpp";

const server = new WebSocketServer({ port });

server.on("connection", (socket, request) => {
  const requestInfo = getRequestInfo(request.url);

  if (!requestInfo.valid) {
    socket.close(1008, `Expected ${path}/{chargerId}`);
    return;
  }

  const { chargerIdentity } = requestInfo;
  console.info(`[ocpp] connected charger=${chargerIdentity}`);

  socket.on("message", (rawMessage) => {
    const parsed = parseOcppMessage(rawMessage);

    if (!parsed.ok) {
      console.warn(`[ocpp] invalid message charger=${chargerIdentity}`, parsed.error);
      socket.send(JSON.stringify(callError(randomUUID(), "FormationViolation", parsed.error)));
      return;
    }

    auditRawMessage({
      chargerIdentity,
      direction: "inbound",
      message: parsed.message
    });

    if (parsed.message[0] !== 2) {
      return;
    }

    const response = handleCall(parsed.message, chargerIdentity);
    auditRawMessage({
      chargerIdentity,
      direction: "outbound",
      message: response
    });
    socket.send(JSON.stringify(response));
  });

  socket.on("close", () => {
    console.info(`[ocpp] disconnected charger=${chargerIdentity}`);
  });
});

server.on("listening", () => {
  console.info(`[ocpp] listening ws://localhost:${port}${path}/{chargerId}`);
});

function getRequestInfo(requestUrl?: string) {
  const url = new URL(requestUrl ?? path, `http://localhost:${port}`);
  const basePath = path.endsWith("/") ? path.slice(0, -1) : path;
  const chargerPathPrefix = `${basePath}/`;
  const valid = url.pathname === basePath || url.pathname.startsWith(chargerPathPrefix);
  const chargerIdentity = url.pathname.startsWith(chargerPathPrefix)
    ? decodeURIComponent(url.pathname.slice(chargerPathPrefix.length))
    : "unknown";

  return {
    valid,
    chargerIdentity: chargerIdentity || "unknown"
  };
}

function parseOcppMessage(rawMessage: RawData):
  | { ok: true; message: OcppMessage }
  | { ok: false; error: string } {
  try {
    const text = rawDataToString(rawMessage);
    const value = JSON.parse(text) as unknown;

    if (!Array.isArray(value)) {
      return { ok: false, error: "OCPP message must be a JSON array" };
    }

    if (value[0] === 2 && typeof value[1] === "string" && typeof value[2] === "string") {
      return {
        ok: true,
        message: [2, value[1], value[2], asRecord(value[3])] satisfies OcppCall
      };
    }

    if (value[0] === 3 && typeof value[1] === "string") {
      return {
        ok: true,
        message: [3, value[1], asRecord(value[2])] satisfies OcppCallResult
      };
    }

    if (
      value[0] === 4 &&
      typeof value[1] === "string" &&
      typeof value[2] === "string" &&
      typeof value[3] === "string"
    ) {
      return {
        ok: true,
        message: [4, value[1], value[2], value[3], asRecord(value[4])] satisfies OcppCallError
      };
    }

    return { ok: false, error: "Unsupported OCPP message shape" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown parse error"
    };
  }
}

function rawDataToString(rawMessage: RawData) {
  if (Array.isArray(rawMessage)) {
    return Buffer.concat(rawMessage).toString("utf8");
  }

  if (rawMessage instanceof ArrayBuffer) {
    return Buffer.from(rawMessage).toString("utf8");
  }

  return rawMessage.toString("utf8");
}

function handleCall(message: OcppCall, chargerIdentity: string): OcppCallResult | OcppCallError {
  const [, uniqueId, action, payload] = message;

  switch (action) {
    case "BootNotification":
      console.info(`[ocpp] boot charger=${chargerIdentity}`, payload);
      return callResult(uniqueId, {
        status: "Accepted",
        currentTime: new Date().toISOString(),
        interval: 60
      });
    case "Heartbeat":
      return callResult(uniqueId, {
        currentTime: new Date().toISOString()
      });
    case "StatusNotification":
    case "MeterValues":
      return callResult(uniqueId, {});
    case "StartTransaction":
      return callResult(uniqueId, {
        transactionId: Math.floor(Date.now() % 2147483647),
        idTagInfo: {
          status: "Accepted"
        }
      });
    case "StopTransaction":
      return callResult(uniqueId, {
        idTagInfo: {
          status: "Accepted"
        }
      });
    default:
      return callError(uniqueId, "NotSupported", `Action ${action} is not supported yet`);
  }
}

function callResult(uniqueId: string, payload: Record<string, unknown>): OcppCallResult {
  return [3, uniqueId, payload];
}

function callError(
  uniqueId: string,
  errorCode: string,
  errorDescription: string
): OcppCallError {
  return [4, uniqueId, errorCode, errorDescription, {}];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function auditRawMessage({
  chargerIdentity,
  direction,
  message
}: {
  chargerIdentity: string;
  direction: "inbound" | "outbound";
  message: OcppMessage;
}) {
  console.info(
    "[ocpp:audit]",
    JSON.stringify({
      chargerIdentity,
      direction,
      messageTypeId: message[0],
      uniqueId: message[1],
      action: message[0] === 2 ? message[2] : undefined,
      rawMessage: message
    })
  );
}
