# IA (Gemini) + Google Calendar — turnos reales por tool calling

## Por qué Gemini y no otro proveedor

El cliente pidió específicamente usar un modelo de Google. Se usa el AI SDK
de Vercel (`ai` + `@ai-sdk/google`) en vez de pegarle directo a la API REST
de Google — da `generateText` con soporte de *tool calling* multi-step
listo para usar.

**Importante:** los IDs de modelo de Gemini cambian seguido. Antes de
hardcodear uno, listar los disponibles:

```bash
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("google/")) | .id] | reverse | .[]'
```

o directo contra la cuenta de Google (útil si se usa la API key directo, sin
pasar por el AI Gateway de Vercel):

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=<GOOGLE_API_KEY>"
```

Se usó `google/gemini-3.8-flash` (el flash más nuevo disponible en el
momento) — para un bot de atención al cliente, "flash" alcanza; no hace
falta el tier "pro".

## Credenciales de Google Calendar: service account, no OAuth

Para que el bot cree eventos en un calendario sin que un humano tenga que
loguearse cada tanto, la opción correcta es una **service account** de
Google Cloud (no un OAuth flow con refresh tokens):

1. `console.cloud.google.com` → crear proyecto → **Habilitar** "Google
   Calendar API".
2. **Credenciales → Crear credenciales → Cuenta de servicio** (elegir
   "Datos de aplicaciones", no "Datos de usuarios" — eso es lo que dispara
   el flujo de OAuth con consentimiento, que no es lo que queremos).
3. Generar una **clave JSON** desde la pestaña "Claves" de esa cuenta de
   servicio. De ahí se sacan `client_email` y `private_key`.
4. **Compartir el calendario real** (calendar.google.com → Configuración y
   uso compartido del calendario elegido) con ese `client_email`, permiso
   **"Realizar cambios en los eventos"**.
5. Copiar el **ID del calendario** (misma pantalla, sección "Integrar
   calendario").

Variables: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
(con los `\n` literales, no saltos de línea reales — el código hace
`.replace(/\\n/g, "\n")`), `GOOGLE_CALENDAR_ID`.

## Diseño del tool-calling

Herramientas expuestas a Gemini (`lib/ai.ts`):

- **`crear_turno`** — antes de crear, chequea conflicto real contra
  `getBusyPeriods` (free/busy de Calendar). Si el horario ya está ocupado,
  devuelve `{ error: "horario_ocupado" }` en vez de duplicar el evento.
- **`consultar_disponibilidad`** — calcula huecos libres reales (ver
  `lib/availability.ts`) contra el horario de atención configurado
  (hardcodeado en ese archivo, ajustar por cliente) y el free/busy de
  Calendar. La IA **nunca debe inventar horarios** — el prompt se lo dice
  explícito.
- **`reagendar_turno`** / **`cancelar_turno`** — identifican el turno por
  `sender_id` (no por nombre). Si el cliente tiene más de un turno activo y
  no se especificó cuál, la herramienta devuelve la lista para que la IA le
  pregunte al cliente antes de tocar nada.

Todas usan `stopWhen: isStepCount(4)` para permitir tool call → resultado →
respuesta final en la misma llamada a `generateReply`.

## El bug más importante que se encontró: "hoy" no existe para el modelo

Un cliente real dijo "mañana" dos veces y la IA volvía a preguntar la fecha
exacta — parecía que perdía el contexto, pero la memoria funcionaba bien
(recordaba servicio, hora, nombre). El problema real: **el modelo no tiene
forma de saber qué fecha es "hoy"**, así que no podía resolver "mañana" a un
`YYYY-MM-DD` concreto que la herramienta necesita.

**Fix:** inyectar la fecha/hora actual del negocio en el system prompt en
cada llamada (`lib/timezone.ts` + `getFechaActualDelNegocio()` en
`lib/ai.ts`):

```
Hoy es lunes 2026-09-07 (formato AAAA-MM-DD) y son las 16:45 hs en el
huso horario del negocio.
```

Calculado a partir de un offset fijo (`BUSINESS_UTC_OFFSET`, ej. `-04:00`)
— no se maneja multi-timezone, cada negocio tiene un solo huso horario.
**Lección para el próximo proyecto:** si un bot va a manejar fechas
relativas ("mañana", "el viernes", "en 2 días"), el prompt necesita sí o sí
la fecha de referencia — no asumir que el modelo "sabe qué día es hoy".

## Errores de herramientas no rompen la conversación

Si una herramienta tira una excepción (ej. `GOOGLE_SERVICE_ACCOUNT_*` no
configurado todavía), el AI SDK la convierte en un `tool-error` y le da a la
IA otro paso para responder con gracia ("tuvimos un problema técnico...")
en vez de que la llamada completa a `generateText` explote. No hace falta
try/catch alrededor de cada tool — ya viene resuelto por el SDK.
