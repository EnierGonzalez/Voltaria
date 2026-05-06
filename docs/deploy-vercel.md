# Deploy to Vercel Staging

Voltaria puede desplegar `apps/web` en Vercel como staging/demo protegido. Este flujo no ejecuta migraciones, seed ni simuladores dentro de Vercel.

## Antes de desplegar

```bash
git status
pnpm typecheck
pnpm build
git add .
git commit -m "Prepare Voltaria for Vercel staging deployment"
git push origin main
```

Si hay cambios de base de datos, correr migraciones desde una máquina segura antes del deploy:

```bash
pnpm db:migrate
pnpm db:seed
```

`DATABASE_URL` debe ser la conexión directa de Neon para migraciones y seed. No uses la URL pooled para estos comandos.

## Opción A recomendada

1. Importa el repositorio de GitHub en Vercel.
2. Selecciona el proyecto de Next.js dentro del monorepo.
3. Configura:
   - Framework: `Next.js`
   - Install command: `pnpm install --frozen-lockfile`
   - Build command: `pnpm build:web`
   - Output: default de Next.js
4. Configura variables de entorno.
5. Despliega.

## Opción B si Vercel no detecta bien el monorepo

1. Mantén como root el repositorio completo.
2. Usa:
   - Install command: `pnpm install --frozen-lockfile`
   - Build command: `pnpm build:web`
3. No configures comandos que ejecuten `db:migrate`, `db:seed`, `outlet:simulator` u OCPP.

## Variables de entorno en Vercel

Staging/demo:

```bash
APP_ENV=staging
NEXT_PUBLIC_APP_NAME=Voltaria
NEXT_PUBLIC_APP_URL=https://<vercel-url>
DATABASE_POOLED_URL=<Neon pooled URL para runtime serverless>
DATABASE_URL=<Neon direct URL para tareas manuales, no para build automático>
RFID_HASH_SECRET=<secret estable>
RFID_READER_API_KEY=<secret para lectores>
STAGING_ACCESS_ENABLED=true
STAGING_ACCESS_USERNAME=<usuario>
STAGING_ACCESS_PASSWORD=<password fuerte>
ENABLE_DEMO_TOOLS=true
```

Notas:

- `DATABASE_POOLED_URL` se usa por runtime web si existe.
- `DATABASE_URL` se mantiene como conexión directa para migraciones y seed desde local.
- Si `APP_ENV` no es `development`, `RFID_HASH_SECRET` no puede faltar ni ser placeholder.
- Si `APP_ENV` no es `development`, `/api/rfid/event` exige `RFID_READER_API_KEY`.
- No imprimas ni pegues valores reales en README, issues o logs.

## No ejecutar en Vercel

- `pnpm outlet:simulator`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm dev:ocpp`

El simulador de tomas sigue siendo un proceso local/separado. Vercel solo sirve `apps/web`.

## Protección staging

`STAGING_ACCESS_ENABLED=true` activa Basic Auth por middleware para UI admin/mobile y endpoints administrativos. Quedan públicos:

- `/_next/*`
- `/favicon.ico`
- `/manifest.webmanifest`
- `/api/health`
- `/api/db-health`
- `/api/config-health`
- `/api/rfid/event`

`/api/rfid/event` no usa Basic Auth; se protege con `X-Voltaria-Reader-Key` cuando `RFID_READER_API_KEY` está configurada.

## Demo tools

`/rfid-simulator` solo está disponible si:

- `ENABLE_DEMO_TOOLS=true`, o
- `APP_ENV` no es `production`

Para producción real, usar `ENABLE_DEMO_TOOLS=false`.

## Health checks

Después del deploy:

- `/api/health`
- `/api/db-health`
- `/api/config-health`

Luego validar con Basic Auth:

- `/dashboard`
- `/outlets`
- `/mobile/outlets/aur-toma-01`
- `/mobile/charge`
- `/rfid-simulator`
- `/billing`
- `/audit`

Este deploy es staging/demo protegido, no producción abierta.
