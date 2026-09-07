# Instagram directo (sin Página de Facebook) → webhook propio

Flujo "API de Instagram con inicio de sesión de Instagram" — más simple que
la Messenger Platform clásica: no hace falta Business Portfolio ni Página de
Facebook vinculada.

⚠️ **Antes de vender esto a un cliente real**, leer la sección de riesgo/App
Review en la guía completa (repo `Dashboard_angu`,
`docs/INSTAGRAM-DIRECTO-META.md`). Resumen: si conectás el Instagram de un
cliente a tu app de Meta sin pasar por la revisión formal de "Tech
Provider", es un atajo válido con pocos clientes pero con riesgo real de que
la cuenta del cliente se caiga si Meta llega a comparar infraestructura
entre negocios "independientes".

## Pasos

1. `developers.facebook.com/apps` → **Crear app** → tipo **Business** → caso
   de uso **"Administrar mensajes y contenido en Instagram"**. Se puede
   dejar sin conectar un Business Portfolio.
2. Panel → Casos de uso → pestaña **"Configuración de la API con inicio de
   sesión de Instagram"** → **"Add all required permissions"**. Ahí quedan
   visibles el **Identificador de la app de Instagram**
   (`META_IG_USER_ID`) y la **Clave secreta** (`META_APP_SECRET`).
3. Roles de la app → Agregar persona con rol **"Evaluador de Instagram"** →
   la cuenta acepta la invitación desde **la propia Instagram**
   (`instagram.com/accounts/manage_access/`), no desde el panel de Meta.
4. Misma pantalla, sección 2 → **Generar token** (`META_PAGE_ACCESS_TOKEN`,
   se muestra una sola vez).
5. Configurar el webhook — requiere el endpoint ya desplegado:
   - URL: `https://<dominio>/api/instagram/webhook`
   - Token de verificación: string propio inventado (`META_VERIFY_TOKEN`)
   - Verificar antes con `curl` (ver abajo) para confirmar que el handshake
     responde antes de intentarlo desde el panel de Meta.
6. Activar el **toggle de suscripción al webhook** (sección 2) — sin esto no
   llega nada aunque el paso 5 esté verde.
7. Completar **URL de política de privacidad** + **categoría** en
   Configuración básica, y **Publicar la app**. Con la app en modo
   Development, los mensajes de cuentas reales (sin rol en la app) **nunca**
   disparan el webhook.

## Código del webhook (patrón usado en este proyecto)

- `GET`: responde el `hub.challenge` si `hub.verify_token` matchea.
- `POST`: valida la firma `X-Hub-Signature-256` (HMAC-SHA256 con
  `META_APP_SECRET` sobre el body crudo) antes de parsear nada.
- Ignora eventos sin `message` (ej. `message_edit`) y los que traen
  `is_echo: true` (eco de la propia respuesta). Ojo: a veces el eco llega
  **sin** `is_echo` — si aparece una respuesta "hablándose sola", agregar una
  guarda extra comparando contra las últimas respuestas propias.
- Responde `200` rápido y hace el trabajo real (IA, DB, etc.) antes de
  responder — Meta reintenta si no hay 200 a tiempo.
- El envío de mensajes es contra `graph.instagram.com` (no
  `graph.facebook.com`) — es el endpoint del flujo "Instagram Login", sin
  Página de Facebook de por medio.

## Verificar el handshake antes de tocar Meta

```bash
curl "https://<dominio>/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=test123"
# debe devolver: test123
```

## Limitaciones conocidas

- **Ventana de 24hs**: solo se puede responder a un cliente dentro de las
  24hs de su último mensaje. El tag `HUMAN_AGENT` (que en la Messenger
  Platform clásica extiende a 7 días) **no funcionó** en este flujo — así
  que retomar una conversación fría solo funciona si el cliente escribe de
  nuevo primero.
- Si la cuenta usó antes GHL/n8n/Manychat, hay que desconectar ese webhook
  antes — Meta solo entrega a una URL a la vez.
