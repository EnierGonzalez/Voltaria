# Deploy Worker

Voltaria web runs on Vercel. The outlet simulator/gateway worker must run outside Vercel as an always-on background process.

## Railway Staging

Create a Railway service from the GitHub repo.

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter @voltaria/outlet-simulator build`
- Start command: `pnpm --filter @voltaria/outlet-simulator start`

Environment variables:

```bash
APP_ENV=staging
DATABASE_URL=postgresql://direct-url
WORKER_SCOPE=all_simulated
OUTLET_SIMULATOR_POLL_INTERVAL_MS=3000
OUTLET_SIMULATOR_METER_INTERVAL_MS=10000
```

For a gateway-scoped worker, use the generated gateway config from Platform Admin:

```bash
WORKER_SCOPE=gateway
WORKER_GATEWAY_CODE=GW-EXAMPLE-SIM
WORKER_GATEWAY_TOKEN=<generated-once>
```

Do not log gateway tokens. If a token is lost, rotate it from Platform Admin and update the worker env vars.

## Render Alternative

Use a Background Worker service with the same install/build/start commands and environment variables.

## Cloud Run Future

For production, use a worker service or always-on container. The same env contract applies, but deployment should add observability, retries, and secret management before connecting physical hardware.

## Local Test

Terminal 1:

```bash
pnpm dev:web
```

Terminal 2:

```bash
pnpm outlet:simulator
```

Gateway scoped:

```bash
WORKER_SCOPE=gateway WORKER_GATEWAY_CODE=GW-TORRE-AURORA-SIM WORKER_GATEWAY_TOKEN=<token> pnpm outlet:simulator
```

