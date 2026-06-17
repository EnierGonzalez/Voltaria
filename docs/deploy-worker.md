# Deploy Worker

Voltaria web runs on Vercel. The outlet simulator/gateway worker must run outside Vercel as an always-on background process. For staging, Railway is the recommended target. Render Background Worker is a compatible alternative.

The worker does not serve the web UI, does not run migrations, does not seed data and does not connect to physical hardware. It only reads/writes operational runtime data in PostgreSQL:

- claims `device_commands` in `pending`
- acknowledges `enable` and `disable`
- moves sessions from `pending_start` to `active`
- inserts `meter_values`
- closes sessions as `completed` when disabled
- updates simulator gateway heartbeat
- writes `system_events` and alerts through the existing runtime

## Required Build Contract

From the repo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @voltaria/outlet-simulator build
pnpm --filter @voltaria/outlet-simulator start
```

`start` runs `node dist/index.js`. Use `pnpm outlet:simulator:dev` only for local development with TypeScript watch mode.

Root scripts:

```bash
pnpm outlet:simulator
pnpm outlet:simulator:build
pnpm outlet:simulator:start
pnpm outlet:simulator:dev
```

`pnpm outlet:simulator` is the safe local compiled path: it builds first and then starts. Railway should use the filtered package `start` command directly.

## Railway Staging

1. Railway -> New Project -> Deploy from GitHub repo -> `EnierGonzalez/Voltaria`.
2. Create one service named `voltaria-outlet-worker`.
3. Root directory: `/`.
4. Install command: `pnpm install --frozen-lockfile`.
5. Build command: `pnpm --filter @voltaria/outlet-simulator build`.
6. Start command: `pnpm --filter @voltaria/outlet-simulator start`.

Environment variables:

```bash
APP_ENV=staging
DATABASE_URL=<Neon direct URL>
WORKER_SCOPE=all_simulated
WORKER_INSTANCE_ID=railway-sim-01
OUTLET_SIMULATOR_POLL_INTERVAL_MS=3000
OUTLET_SIMULATOR_METER_INTERVAL_MS=10000
OUTLET_SIMULATOR_HEARTBEAT_INTERVAL_MS=30000
```

Do not use `DATABASE_POOLED_URL` for this worker. The worker is a persistent process and uses the direct Neon URL. Migrations and seed still run manually outside Railway.

Variables the worker does not need:

```bash
AUTH_SESSION_SECRET
STAGING_ACCESS_PASSWORD
NEXT_PUBLIC_APP_URL
RFID_READER_API_KEY
RFID_HASH_SECRET
```

Those variables remain for web/auth/RFID flows. Add them to the worker only if a future worker actually handles that concern.

## Scope Modes

### `all_simulated`

Recommended for staging/demo while there is no hardware. It processes commands and active sessions for:

- simulator gateways
- legacy commands/sessions without `gateway_id`

It does not process gateways marked `disabled` or `revoked`.

```bash
WORKER_SCOPE=all_simulated
```

### `property`

Use when a worker must be limited to one property.

```bash
WORKER_SCOPE=property
WORKER_PROPERTY_ID=<property uuid>
```

### `gateway`

Use for one logical gateway. This validates the token against `gateway_devices.auth_token_hash` and fails if the gateway is disabled or revoked.

```bash
WORKER_SCOPE=gateway
WORKER_GATEWAY_CODE=GW-TORRE-AURORA-SIM
WORKER_GATEWAY_TOKEN=<generated-once>
```

Do not log gateway tokens. If a token is lost, rotate it from Platform Admin and update Railway env vars.

## Logs

Expected safe log lines:

- `worker started`
- `heartbeat`
- `tick processed`
- `tick failed; backing off`
- `worker shutting down`

Logs include app env, scope, instance id, intervals and counts. They must not include `DATABASE_URL`, gateway tokens, RFID raw values or other secrets.

If Neon is temporarily unavailable, the worker backs off in this sequence:

```text
3s -> 5s -> 10s -> 30s -> 60s max
```

When DB connectivity returns, it resumes the normal poll interval.

## Health Endpoints

If Railway provides `PORT`, the worker starts a small HTTP server:

- `GET /health`: process-level health, no DB query.
- `GET /ready`: checks DB reachability with `select 1`.

If no `PORT` is present, the worker runs only as a background process and Railway validation should use logs plus Platform Admin.

## Render Alternative

Use a Render Background Worker with the same repo, install/build/start commands and environment variables.

## Local Test

Terminal 1:

```bash
pnpm dev:web
```

Terminal 2, compiled mode:

```bash
pnpm outlet:simulator
```

Terminal 2, development mode:

```bash
pnpm outlet:simulator:dev
```

Routes to inspect:

- `http://localhost:3000/api/health`
- `http://localhost:3000/platform/gateways`
- `http://localhost:3000/platform/system`
- `http://localhost:3000/app/voltaria-demo/torre-aurora/outlets`

Manual staging flow:

1. Login in Vercel.
2. Open `/app/voltaria-demo/torre-aurora/outlets`.
3. Start a session from mobile or admin.
4. Railway worker claims the `enable` command.
5. Session moves from `pending_start` to `active`.
6. `meter_values` start increasing.
7. Stop the session.
8. Worker claims the `disable` command.
9. Session closes as `completed`.

If a session remains `pending_start`, check:

1. Railway logs.
2. `/platform/gateways` for `Worker activo` and recent heartbeat.
3. `/platform/system` for tenant isolation warnings.
4. `/api/config-health` for `stuckCommandsCount` and `stuckSessionsCount`.
5. `device_commands` status, `locked_by`, `locked_at`, `attempts` and `last_error`.
6. Gateway `last_seen_at` and `status`.

## Production Notes

This is still a simulated staging worker. Before physical hardware:

- add structured logging/observability
- define alert thresholds for stuck commands
- separate simulator workers from real gateway workers
- enforce gateway-scoped workers for physical devices
- add secret rotation procedures
- decide deployment target per customer/property
