# Base de datos — Neon Postgres vía Vercel Marketplace

Se usa para dos cosas: memoria de conversación por cliente de Instagram, y
registro de turnos (para poder reagendar/cancelar sin depender solo de
Google Calendar).

## Por qué Neon (y no Upstash/Redis)

Se evaluaron Neon Postgres y Upstash Redis (ambos vía Vercel Marketplace).
Se eligió **Postgres** porque, además de la memoria de conversación (que es
puro key-value), hacía falta guardar turnos de forma consultable
(`WHERE sender_id = ... AND status = 'confirmed'`) — Redis también podría,
pero Postgres es más cómodo para esa consulta y para reportes a futuro.

## Cómo se instaló (dashboard, no CLI)

1. Vercel Dashboard → proyecto → pestaña **Storage** → **Create Database**
   → **Neon** (Postgres) → plan Free alcanza.
2. Conectar al proyecto (marca los 3 environments: Production, Preview,
   Development). Esto **auto-inyecta** `DATABASE_URL` y variables
   relacionadas (`PGHOST`, `POSTGRES_*`, etc.) — no hace falta copiarlas a
   mano.
3. Local: `vercel env pull .env.local --environment=production` para traer
   el `DATABASE_URL` real (ver `05-VERCEL-MULTICUENTA.md` si el proyecto de
   Vercel pertenece a otra cuenta).

## Esquema (se crea solo, sin migraciones manuales)

En vez de usar `drizzle-kit` o migraciones formales (overkill para este
tamaño de proyecto), el propio código de la app crea las tablas con
`CREATE TABLE IF NOT EXISTS` de forma perezosa (la primera vez que se
necesitan, dentro de una función lazy `ensureSchema()` — nunca en el top
level del módulo, porque `next build` evalúa el módulo sin `DATABASE_URL`
todavía configurado y rompería el build).

```sql
create table if not exists conversations (
  sender_id text primary key,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id bigserial primary key,
  sender_id text not null,
  service text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  calendar_event_id text,
  created_at timestamptz not null default now(),
  status text not null default 'confirmed'  -- agregado despues via ALTER TABLE ADD COLUMN IF NOT EXISTS
);
```

- `conversations.messages`: array de `{role, content}`, recortado a los
  últimos 20 mensajes antes de guardar (evita mandarle a la IA un historial
  gigante en cada llamada).
- `bookings`: `sender_id` es la clave para reagendar/cancelar — **no** se
  usa el nombre del cliente para identificar el turno (puede repetirse o
  tener typos); el `sender_id` de Instagram es 1:1 con la conversación.

## Degradación agraciada (importante)

Si `DATABASE_URL` todavía no está configurado (ej. se hace deploy antes de
provisionar la base), el webhook **no debe quedar mudo**. Patrón usado:

```ts
const history = await getConversation(senderId).catch((err) => {
  console.error(...);
  return [];
});
```

Así el bot sigue respondiendo (sin memoria) en vez de romperse por completo.
`recordBooking`/`updateBooking`/`cancelBooking` sí pueden fallar más
"ruidosamente" porque van dentro del tool-calling de la IA, que ya maneja
errores de herramientas como `tool-error` sin tirar abajo toda la respuesta
(ver `03-GOOGLE-CALENDAR-IA.md`).
