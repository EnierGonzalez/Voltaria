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

Selector de propiedad: `http://localhost:3000/select-property`

Platform Admin: `http://localhost:3000/platform`

Tenant Admin: `http://localhost:3000/app/voltaria-demo/torre-aurora/dashboard`

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

El seed es idempotente para desarrollo: actualiza la propiedad `torre-aurora`, asegura lectores RFID demo, reglas operativas y overrides sin borrar sesiones existentes. No imprime ni registra el valor de `DATABASE_URL`.

## Desarrollo

```bash
pnpm dev:web
pnpm dev:ocpp
```

Validación local:

```bash
pnpm typecheck
pnpm build
pnpm build:web
```

Rutas útiles:

- Selector: `http://localhost:3000/select-property`
- Platform Admin: `http://localhost:3000/platform`
- Tenant dashboard: `http://localhost:3000/app/voltaria-demo/torre-aurora/dashboard`
- Cargadores: `http://localhost:3000/app/voltaria-demo/torre-aurora/chargers`
- Tomas 120V: `http://localhost:3000/app/voltaria-demo/torre-aurora/outlets`
- Residentes: `http://localhost:3000/app/voltaria-demo/torre-aurora/residents`
- Sesiones: `http://localhost:3000/app/voltaria-demo/torre-aurora/sessions`
- PWA móvil: `http://localhost:3000/mobile/home`
- PWA tomas: `http://localhost:3000/mobile/outlets`
- OCPP server: `ws://localhost:9220/ocpp/{chargerId}`

Las rutas legacy como `/dashboard`, `/outlets`, `/sessions`, `/residents`, `/billing`,
`/audit`, `/reports` y `/settings` redirigen al tenant activo en
`/app/[organizationSlug]/[propertySlug]/...`, a `/select-property` si el usuario tiene
varias propiedades, o a `/platform` si es un usuario platform sin propiedad asignada.
Las rutas legacy `/app/[propertySlug]/...` siguen existiendo temporalmente y redirigen a
la URL canónica cuando la propiedad se puede resolver sin ambigüedad.

Fuera de development demo, Voltaria no usa fallback automático a `Torre Aurora`.
Los flujos mobile requieren usuario residente con `property_id`; los CSV de reportes
requieren `propertyId` o `organizationSlug` + `propertySlug`; y el runtime local demo
solo usa residente demo cuando ya existe una toma/property explícita.

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

- `http://localhost:3000/app/voltaria-demo/torre-aurora/outlets`
- `http://localhost:3000/mobile/outlets`
- `http://localhost:3000/mobile/outlets/aur-toma-01`
- `http://localhost:3000/mobile/charge`
- `http://localhost:3000/app/voltaria-demo/torre-aurora/dashboard`

Prueba manual:

1. Abre `/mobile/outlets/aur-toma-01`.
2. Presiona `Iniciar carga`.
3. Verifica que se cree una sesión `pending_start`.
4. Deja correr `pnpm outlet:simulator` para pasarla a `active`.
5. Abre `/mobile/charge` y revisa kWh, tiempo, potencia y costo.
6. Presiona `Detener carga`.
7. Confirma que el simulador cierre la sesión como `completed`.

## RFID Local Testing

Terminal 1:

```bash
pnpm dev:web
```

Terminal 2:

```bash
pnpm outlet:simulator
```

Opcional:

```bash
pnpm db:studio
```

Prueba 1 - asignar manual:

1. Abre `/residents`.
2. Entra a María López.
3. Asigna `RFID-DEMO-1204` como RFID manual.
4. Verifica que solo se muestre el valor enmascarado.

Prueba 2 - simular tap RFID:

1. Abre `/rfid-simulator`.
2. Selecciona `RFID-PANEL-P1`.
3. Selecciona `AUR-TOMA-01`.
4. Usa `RFID-DEMO-1204`.
5. Presiona `Simular tap`.
6. Revisa el resultado `accepted`, `rejected`, `captured` o `blocked`.
7. Abre `/mobile/charge` para ver kWh, tiempo, potencia y costo cuando haya sesión activa.

Prueba 3 - detener:

1. Desde `/mobile/charge`, presiona `Detener carga`.
2. También puedes simular un segundo tap RFID sobre la misma toma y sesión propia.
3. El simulador procesará el comando `disable` y cerrará la sesión.

Prueba 4 - enrollment:

1. Abre el detalle de un residente.
2. Inicia `Captura desde lector`.
3. Abre `/rfid-simulator`.
4. Simula un tap con un idTag nuevo, por ejemplo `RFID-NUEVA-001`.
5. Verifica que el enrollment cambie a `captured` y que aparezca una credencial activa.

RFID usa `RFID_HASH_SECRET` para HMAC-SHA256. En desarrollo puede usar fallback local si no está configurado, pero producción debe definirlo. La UI nunca muestra el idTag completo ni el hash.

## Operational Rules

El motor de reglas vive en `packages/db/src/rules-engine.ts`. Antes de crear una sesión o un `device_command`, `evaluateStartSession` valida propiedad, toma, residente, departamento, método de activación, horario, límites simultáneos, tarifa activa y comandos pendientes. Cada decisión queda auditada en `rule_evaluations`.

Capas de configuración:

- `property_access_rules`: regla activa por propiedad, métodos permitidos, límites de sesión, timeouts, umbral de baja potencia y acción por sobrecorriente.
- `access_schedule_windows`: ventanas por día de la semana. El seed deja 24/7 con `00:00-23:59`.
- `outlet_access_overrides`: estado operativo y límites específicos por toma.
- `resident_access_overrides`: bloqueo, suspensión o limitación por residente.
- `apartment_access_overrides`: límites y bloqueos por departamento.

UI:

- `/settings/rules`: editar regla activa, métodos permitidos, límites y horario diario.
- `/outlets`: poner tomas en mantenimiento, deshabilitar o habilitar mediante override.
- `/residents/[residentId]`: bloquear, desbloquear o limitar acceso de un residente sin tocar sus credenciales RFID.

Seed operativo:

- Crea `Regla residencial estándar`.
- Permite RFID, móvil y admin.
- Limita a 1 sesión activa por residente, 2 por departamento y 16 por propiedad.
- Define duración máxima de 480 minutos.
- Define startup no-load de 90 s, no-load sostenido de 600 s, umbral de 20 W y sobrecorriente con `stop_session`.
- Deja `AUR-TOMA-16` en mantenimiento para validar denegaciones.

Pruebas manuales:

1. Toma en mantenimiento: abre `/mobile/outlets/aur-toma-16` e intenta iniciar. Debe negar. En `/rfid-simulator`, selecciona `AUR-TOMA-16`; el tap RFID también debe negar.
2. Límite por residente: inicia una sesión para el residente demo e intenta iniciar otra. Debe responder que ya existe una sesión activa.
3. Método deshabilitado: en `/settings/rules`, desactiva `Móvil`, guarda e intenta iniciar desde PWA. RFID debe seguir permitido si continúa activo.
4. Horario: cambia la ventana a un horario fuera del actual y valida que mobile/RFID respondan `outside_schedule`.
5. No-load y sobrecorriente: deja correr `pnpm outlet:simulator`; el runtime usa los timeouts, umbral y acción configurados en la regla activa.

## Billing and Audit

La auditoría operativa vive en `packages/db/src/session-audit-service.ts`. Cada sesión puede generar un registro en `session_audits` con estado de auditoría, medición, comandos, reglas y estado de cobro. La lógica compara kWh declarados, `meter_values`, acknowledgements de `device_commands`, motivos de paro por regla y límites razonables para tomas 120V.

La conciliación de cortes vive en `packages/db/src/billing-cycle-service.ts`. `billing_records` se conserva como resumen legacy/compatibilidad; la nueva fuente formal para cortes administrativos es `billing_cycles` junto con `billing_cycle_items` y `billing_cycle_session_items`.

Rutas:

- `/audit`: revisión operativa de sesiones, filtros, detalle y acciones de incluir/excluir de cobro.
- `/reports/audit`: misma vista de auditoría desde reportes.
- `/billing`: KPIs del periodo y creación de corte draft.
- `/billing/cycles`: lista de cortes.
- `/billing/cycles/[cycleId]`: detalle de corte, recalcular, aprobar, cerrar y exportar CSV.

CSV directos:

- `/api/billing-cycles/[cycleId]/export.csv`
- `/api/reports/sessions.csv`
- `/api/reports/audit.csv`

No hay storage, PDF, email, pagos, CFDI/SAT ni bancos en esta fase. Cada exportación registra un `export_job` completado para trazabilidad.

Flujo manual:

1. Genera una sesión con mobile o RFID.
2. Corre `pnpm outlet:simulator` para crear `meter_values`.
3. Detén la sesión desde `/mobile/charge` o RFID.
4. Abre `/audit` y revisa auditoría, medición, comandos y reglas.
5. Abre `/billing`, selecciona periodo y crea un corte draft.
6. Entra al detalle del corte para revisar departamentos/residentes, sesiones incluidas y warnings.
7. Exporta CSV para cobro administrativo interno.

Pruebas sugeridas:

- Sesión normal completada con kWh mayor a cero.
- Sesión completada sin consumo.
- Sesión con falta de `meter_values`.
- Sesión detenida por regla.
- Corte mensual con sesiones cobrables y pendientes de revisión.
- Export CSV de corte, sesiones y auditoría.

## Platform Admin y provisioning SaaS

Platform Admin permite operar Voltaria como SaaS multi-tenant.

Platform Admin y Tenant Admin usan shells separados. Platform no muestra el header,
footer ni navegación de `Torre Aurora`; opera en scope global SaaS. Tenant Admin vive
en `/app/[organizationSlug]/[propertySlug]` y siempre carga datos con `property_id`
explícito desde un contexto que valida organization + property + membership.

Rutas:

- `/platform`: métricas globales de tenants, propiedades, tomas, gateways, sesiones y alertas.
- `/platform/tenants`: listado de organizaciones/clientes.
- `/platform/tenants/new`: provisioning de tenant, propiedad, tomas, tarifa, reglas, usuario inicial y gateway lógico.
- `/platform/tenants/[organizationId]`: detalle operativo del tenant.
- `/platform/gateways`: inventario global de gateways.
- `/platform/system`: diagnostics de aislamiento SaaS con conteos por organization/property y warnings.
- `/platform/users`, `/platform/support`, `/platform/settings`: placeholders globales para administración SaaS futura.

En `/platform/tenants`, cada fila permite ver detalle, abrir el tenant admin,
ver gateways y activar/desactivar el tenant si el usuario tiene `platform.tenants.manage`.
No se implementa hard delete de tenants.

Rutas tenant:

- `/app/[organizationSlug]/[propertySlug]/dashboard`
- `/app/[organizationSlug]/[propertySlug]/outlets`
- `/app/[organizationSlug]/[propertySlug]/chargers`
- `/app/[organizationSlug]/[propertySlug]/sessions`
- `/app/[organizationSlug]/[propertySlug]/residents`
- `/app/[organizationSlug]/[propertySlug]/billing`
- `/app/[organizationSlug]/[propertySlug]/audit`
- `/app/[organizationSlug]/[propertySlug]/reports`
- `/app/[organizationSlug]/[propertySlug]/settings`
- `/app/[organizationSlug]/[propertySlug]/settings/rules`
- `/app/[organizationSlug]/[propertySlug]/settings/users`
- `/app/[organizationSlug]/[propertySlug]/rfid-simulator`

Diagnostics de aislamiento:

- `/platform/system` muestra `APP_ENV`, `ENABLE_DEMO_TOOLS`, si el fallback default está permitido, conteos de tomas 120V vs otros puntos, comandos, sesiones, usuarios y gateways por propiedad.
- Los warnings globales incluyen properties sin organización, gateways con organization/property inconsistente, usuarios sin membership y referencias huérfanas si aparecen.

Permisos:

- `platform_owner`: administra tenants y gateways.
- `platform_admin`: administra tenants y gateways sin impersonation.
- `platform_support`: vista de tenants/gateways y salud del sistema.

Flujo para nuevo tenant:

1. Inicia sesión como usuario con `platform.tenants.manage`.
2. Abre `/platform/tenants/new`.
3. Captura cliente, propiedad, número de tomas, tarifa, owner inicial y gateway.
4. Al crear, copia la contraseña temporal y el token del gateway; solo se muestran una vez.
5. `outletCount` puede ser `0` para crear un tenant vacío; en ese caso no se crean tomas.
6. Usa `Abrir panel del tenant` para entrar a `/app/[organizationSlug]/[propertySlug]/dashboard`.
7. Entrega el JSON de config al worker/gateway correspondiente.

El seed crea la organización `Voltaria Demo`, asocia `Torre Aurora`, marca `admin@voltaria.local` como `platform_owner` y provisiona `GW-TORRE-AURORA-SIM`. No imprime tokens ni secretos.

## Worker / gateway deploy

La web corre en Vercel. El worker de tomas no corre en Vercel; para staging 24/7 usa Railway, Render o un servicio always-on.

Comandos base:

```bash
pnpm dev:web
pnpm outlet:simulator
```

Variables principales:

```bash
WORKER_SCOPE=all_simulated
OUTLET_SIMULATOR_POLL_INTERVAL_MS=3000
OUTLET_SIMULATOR_METER_INTERVAL_MS=10000
```

Para worker por gateway:

```bash
WORKER_SCOPE=gateway
WORKER_GATEWAY_CODE=GW-TORRE-AURORA-SIM
WORKER_GATEWAY_TOKEN=<token-generado-una-vez>
```

Guía completa: `docs/deploy-worker.md`.

## Deploy to Vercel Staging

La guía completa está en `docs/deploy-vercel.md`.

Resumen:

- Vercel debe compilar solo `apps/web` con `pnpm build:web`.
- Vercel no debe correr `pnpm db:migrate`, `pnpm db:seed`, `pnpm outlet:simulator` ni OCPP.
- Runtime web usa `DATABASE_POOLED_URL` si existe; migraciones y seed siguen usando `DATABASE_URL` directa.
- Staging/demo debe usar `STAGING_ACCESS_ENABLED=true` para Basic Auth temporal.
- `/api/health`, `/api/db-health` y `/api/config-health` sirven para verificación post-deploy sin exponer secretos.
- Este despliegue es staging/demo protegido, no producción pública.

## Auth

Voltaria ahora usa login interno con usuarios propios, roles y sesiones en cookie `httpOnly`. No usa Supabase Auth todavía y sigue preparado para migrar la base a Supabase PostgreSQL después.

Variables relevantes:

```bash
AUTH_SESSION_SECRET="secret-estable"
AUTH_SESSION_HOURS="12"
FIRST_OWNER_EMAIL="admin@voltaria.local"
FIRST_OWNER_PASSWORD="password-temporal-solo-para-seed"
FIRST_OWNER_NAME="Voltaria Owner"
```

Antes de ejecutar `pnpm db:seed` en un ambiente nuevo, define `FIRST_OWNER_EMAIL`, `FIRST_OWNER_PASSWORD` y `AUTH_SESSION_SECRET`. El seed crea el primer owner si no existe y marca `must_change_password=true` para forzar cambio al primer login. No imprime contraseñas ni secrets.

Roles principales:

- `owner`: acceso total, incluyendo administración crítica de roles.
- `admin`: operación completa, sin asignación crítica de owner.
- `operations`: tomas, sesiones y residentes operativos.
- `accounting`: billing, audit y exportaciones.
- `auditor`: lectura de sesiones, billing, audit y reportes.
- `resident`: PWA móvil, acceso RFID y sesiones propias.
- `support`: lectura operativa, salud del sistema y simulador RFID.

Rutas nuevas:

- `/login`: inicio de sesión interno.
- `/change-password`: cambio obligatorio o manual de contraseña.
- `/403`: acceso denegado.
- `/select-property`: selector de propiedad cuando el usuario tiene varias membresías.
- `/app/[organizationSlug]/[propertySlug]/settings/users`: administración tenant de usuarios, roles, estado y contraseñas temporales.

Estrategia staging:

1. Mantén `STAGING_ACCESS_ENABLED=true` si quieres un candado externo adicional.
2. Entra por `/login` con el owner creado por seed.
3. Crea usuarios reales desde `/settings/users`.
4. Cuando el login interno esté validado en Vercel, puedes cambiar `STAGING_ACCESS_ENABLED=false`.

Seguridad:

- Passwords se guardan con `scrypt` y salt aleatorio.
- La cookie de sesión es `httpOnly`, `sameSite=lax` y `secure` fuera de development.
- `user_sessions` guarda hash del token, no el token plano.
- Acciones administrativas y CSV validan permisos server-side.
- `/api/rfid/event` sigue usando `RFID_READER_API_KEY`, no sesión web.

## Regla de producto

La UI y el modelo inicial muestran solo datos de sesión: energía entregada, tiempo, potencia, costo, cargador, residente y departamento. No se modela ni se muestra batería del vehículo.
