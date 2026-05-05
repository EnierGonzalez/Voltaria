# Voltaria

Plataforma SaaS para control y monitoreo de puntos de carga en torres de departamentos. El caso principal actual son tomas controladas 120V para carritos de golf eléctricos; OCPP 1.6J se mantiene como compatibilidad futura.

## Stack

- Monorepo con pnpm workspaces
- `apps/web`: Next.js App Router, TypeScript, Tailwind y base compatible con shadcn/ui
- `apps/ocpp-server`: Node.js, TypeScript y `ws` para OCPP 1.6J
- `apps/outlet-simulator`: runtime simulado para gateway de tomas 120V
- `packages/db`: Drizzle ORM, schema PostgreSQL y carpeta de migrations
- `packages/ui`: componentes visuales compartidos
- `packages/shared`: tipos, constantes, validaciones y datos mock
- PostgreSQL en Neon ahora, preparado para apuntar a Supabase PostgreSQL después
- Repositorios Drizzle con fallback a mocks cuando `DATABASE_URL` no está configurado

## Primer uso

```bash
npm install -g pnpm
pnpm install
cp .env.example .env.local
pnpm dev
```

Web admin: `http://localhost:3000/dashboard`

PWA móvil: `http://localhost:3000/mobile/home`

OCPP server: `ws://localhost:9220/ocpp/{chargerId}`

## Base de datos

Configura `DATABASE_URL` en `.env` usando la conexión directa de Neon, no la pooled. El mismo valor puede apuntar después a Supabase PostgreSQL sin cambiar la capa de datos.

Los scripts fallan con un mensaje claro si `DATABASE_URL` no está configurado o si parece ser una URL pooled.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Comandos disponibles:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:seed
pnpm db:studio
```

El schema vive en `packages/db/src/schema.ts` e incluye `property_id` para multi-torre, mensajes OCPP crudos para auditoría y tablas separadas para residentes, cargadores, sesiones, mediciones, tarifas y facturación.

El seed es idempotente para desarrollo: recrea solo la propiedad `torre-aurora` y sus datos asociados. No imprime ni registra el valor de `DATABASE_URL`.

## Desarrollo

```bash
pnpm dev:web
pnpm dev:ocpp
```

Validación local:

```bash
pnpm typecheck
pnpm build
```

Rutas útiles:

- Admin: `http://localhost:3000/dashboard`
- Cargadores: `http://localhost:3000/chargers`
- Tomas 120V: `http://localhost:3000/outlets`
- Residentes: `http://localhost:3000/residents`
- Sesiones: `http://localhost:3000/sessions`
- PWA móvil: `http://localhost:3000/mobile/home`
- PWA tomas: `http://localhost:3000/mobile/outlets`
- OCPP server: `ws://localhost:9220/ocpp/{chargerId}`

## Simulador de tomas 120V

El simulador procesa `device_commands` pendientes, confirma comandos `enable`/`disable`, mueve sesiones `pending_start` a `active`, genera `meter_values` cada pocos segundos y cierra sesiones al detenerlas. No usa APIs de hardware ni proveedores específicos.

Terminal 1:

```bash
pnpm dev:web
```

Terminal 2:

```bash
pnpm outlet:simulator
```

Rutas para probar:

- `http://localhost:3000/outlets`
- `http://localhost:3000/mobile/outlets`
- `http://localhost:3000/mobile/outlets/aur-toma-01`
- `http://localhost:3000/mobile/charge`
- `http://localhost:3000/dashboard`

Prueba manual:

1. Abre `/mobile/outlets/aur-toma-01`.
2. Presiona `Iniciar carga`.
3. Verifica que se cree una sesión `pending_start`.
4. Deja correr `pnpm outlet:simulator` para pasarla a `active`.
5. Abre `/mobile/charge` y revisa kWh, tiempo, potencia y costo.
6. Presiona `Detener carga`.
7. Confirma que el simulador cierre la sesión como `completed`.

## Auth

La capa de auth está modelada sin acoplarse a Neon, Supabase ni otro proveedor. `resident_credentials` guarda identidad externa de forma genérica y `packages/shared/src/auth.ts` define contratos para conectar un proveedor real después.

## Regla de producto

La UI y el modelo inicial muestran solo datos de sesión: energía entregada, tiempo, potencia, costo, cargador, residente y departamento. No se modela ni se muestra batería del vehículo.
