# Espejo de conversaciones hacia Chatwoot

Panel de solo lectura para que el staff vea las conversaciones sin tocar el
flujo de IA. Mismo patrón ya usado en otros proyectos (ver
`Dashboard_angu/docs/CHATWOOT-ESPEJO-INSTAGRAM.md` para el detalle
original con WhatsApp/Instagram de otro cliente).

## Arquitectura (por qué así)

Chatwoot **no se conecta directo a Meta**. Un canal de Instagram nativo en
Chatwoot le robaría los mensajes al webhook propio que corre la IA (Meta
solo entrega a una URL por cuenta). En cambio:

- Se crea un inbox tipo **`Channel::Api`** en una instancia de Chatwoot ya
  existente (self-hosted, compartida entre varios clientes/negocios — cada
  uno con su propio inbox, sin mezclar datos).
- El propio código de este proyecto le manda una **copia** de cada mensaje
  (entrante del cliente, saliente de la IA) justo después de procesarlo.
- Chatwoot nunca contesta nada por su cuenta ni recibe nada directo de Meta.

## Setup (por SSH, en el servidor de Chatwoot)

Esto es una acción de alto riesgo (acceso root a un servidor compartido) —
**que lo corra el dueño del servidor**, no un agente/asistente sin
supervisión.

```bash
ssh root@<ip-del-vps>
cd /opt/chatwoot

docker compose exec rails bundle exec rails runner '
  account = Account.find(1)  # la cuenta compartida existente

  channel = Channel::Api.create!(account: account)
  inbox = Inbox.create!(name: "Instagram <Cliente> (espejo)", account: account, channel: channel)
  InboxMember.find_or_create_by!(inbox: inbox, user: User.find(1))  # admin

  # Usuario dedicado para que la IA postee bajo su propia identidad
  # (evita que un mensaje de la IA se confunda con uno de un humano real)
  pass = SecureRandom.hex(20) + "Aa1!"
  bot_user = User.new(name: "IA <Cliente>", email: "ia-<cliente>-bot@<dominio>.internal", password: pass)
  bot_user.skip_confirmation! if bot_user.respond_to?(:skip_confirmation!)
  bot_user.save!
  AccountUser.create!(account: account, user: bot_user, role: "agent")
  InboxMember.find_or_create_by!(inbox: inbox, user: bot_user)

  puts "INBOX_ID=#{inbox.id}"
  puts "BOT_USER_ID=#{bot_user.id}"
  puts "BOT_ACCESS_TOKEN=#{bot_user.access_token.token}"
'
```

Variables resultantes para `.env`:

```
CHATWOOT_BASE_URL="https://<host-de-chatwoot>"
CHATWOOT_ACCOUNT_ID="1"
CHATWOOT_INBOX_ID="<INBOX_ID de arriba>"
CHATWOOT_ACCESS_TOKEN="<BOT_ACCESS_TOKEN de arriba>"
```

## Código (`lib/chatwoot.ts`)

- Usa la **Application API** de Chatwoot (header `api_access_token` +
  `account_id`), no el Client API público.
- El contacto se identifica por el **sender_id de Instagram** (no hay
  teléfono de por medio) — campo `identifier` de Chatwoot.
- Busca contacto existente por `identifier`; si no existe, lo crea. Busca
  conversación abierta en el inbox correcto; si no existe, la crea.
- **Best-effort:** si faltan las env vars `CHATWOOT_*`, no-op silencioso. Si
  falla la llamada HTTP, solo `console.error` — nunca debe interrumpir la
  respuesta real al cliente.
- Conectado en dos puntos: saliente dentro de `sendInstagramMessage()` (así
  cubre automáticamente cualquier rama de código que responda), entrante
  con una línea al principio del handler del webhook, antes de generar la
  respuesta.

## Verificar sin esperar tráfico real

```bash
curl -X POST "<CHATWOOT_BASE_URL>/api/v1/accounts/<ID>/contacts/search?q=<identifier-de-prueba>" \
  -H "api_access_token: <token>"
```

Y para limpiar un contacto de prueba: `DELETE /contacts/<id>` — ojo, el
usuario "bot" dedicado normalmente **no tiene permiso de admin** para
borrar contactos (da 401); hay que usar el token del usuario admin para esa
limpieza puntual.

## Pendiente / no implementado en este proyecto

- **Responder desde Chatwoot** (bidireccional): existe el patrón (webhook
  de vuelta `message_created` → relay a la Graph API), pero acá no se
  armó. Si se necesita, ver `CHATWOOT-ESPEJO-INSTAGRAM.md` de Angustore,
  sección "Responder desde Chatwoot" — incluye el hallazgo de que el tag
  `HUMAN_AGENT` no extiende la ventana de 24hs en este flujo de Instagram
  (sí en la Messenger Platform clásica).
