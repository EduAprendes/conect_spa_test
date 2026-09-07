# Docs — Conect Spa (Instagram + IA + Calendar)

Resumen de cómo se armó este proyecto, para reusar el mismo patrón en un
cliente nuevo sin arrancar de cero. Cada doc cubre una pieza:

1. [`01-INSTAGRAM-META.md`](./01-INSTAGRAM-META.md) — conectar una cuenta de
   Instagram directo (sin Página de Facebook) a un webhook propio.
2. [`02-BASE-DE-DATOS-NEON.md`](./02-BASE-DE-DATOS-NEON.md) — Postgres
   (Neon) vía Vercel Marketplace para memoria de conversación y turnos.
3. [`03-GOOGLE-CALENDAR-IA.md`](./03-GOOGLE-CALENDAR-IA.md) — IA (Gemini)
   con tool-calling para crear/reagendar/cancelar turnos y consultar
   disponibilidad real contra Google Calendar.
4. [`04-CHATWOOT-ESPEJO.md`](./04-CHATWOOT-ESPEJO.md) — espejo de solo
   lectura de las conversaciones hacia un panel de Chatwoot compartido.
5. [`05-VERCEL-MULTICUENTA.md`](./05-VERCEL-MULTICUENTA.md) — lecciones
   aprendidas sobre trabajar con un repo de GitHub y un proyecto de Vercel
   que pertenecen a **cuentas distintas** (muy común: vos desarrollás,
   el cliente es dueño del proyecto).

## Stack usado

- **Next.js (App Router)** en Vercel — un solo endpoint (`/api/instagram/webhook`)
  hace de webhook receptor y orquestador.
- **Google Gemini** (`@ai-sdk/google` + `ai`) para las respuestas, con
  *tool calling* para las acciones reales (crear/reagendar/cancelar turno,
  consultar disponibilidad).
- **Neon Postgres** (Vercel Marketplace) para memoria de conversación y
  registro de turnos.
- **Google Calendar API** (service account) como fuente de verdad de la
  disponibilidad real.
- **Chatwoot** (self-hosted, instancia compartida) como panel de solo
  lectura para el staff.

## Variables de entorno (ver `.env.example` del proyecto)

```
# Instagram / Meta
META_IG_USER_ID=
META_PAGE_ACCESS_TOKEN=
META_APP_SECRET=
META_VERIFY_TOKEN=

# IA
GOOGLE_API_KEY=

# Base de datos
DATABASE_URL=

# Google Calendar (service account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=
BUSINESS_UTC_OFFSET=-04:00

# Chatwoot (opcional)
CHATWOOT_BASE_URL=
CHATWOOT_ACCOUNT_ID=
CHATWOOT_INBOX_ID=
CHATWOOT_ACCESS_TOKEN=
```

## Pendiente / ideas para la próxima vez

- Notificaciones (WhatsApp Cloud API, Slack, email) cuando se confirma un
  turno — evaluado pero no implementado en este proyecto. Ver conversación
  del `2026-09-07`: Baileys (no oficial) se descartó por riesgo de baneo del
  número; WhatsApp Cloud API es la opción segura pero requiere aprobar una
  plantilla de mensaje.
- Dashboard propio (lista de turnos con filtros) leyendo la tabla
  `bookings` — hoy solo existe el espejo de Chatwoot y el calendario.
