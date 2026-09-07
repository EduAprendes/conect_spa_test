/**
 * Espejo de los mensajes de Instagram hacia un inbox de Chatwoot (self-hosted,
 * instancia compartida entre varios negocios en un VPS aparte), solo para que
 * el staff pueda LEER las conversaciones desde un panel. Meta le sigue
 * mandando los webhooks a nuestro propio endpoint (app/api/instagram/webhook),
 * que sigue corriendo la IA sin cambios. Chatwoot nunca recibe el mensaje
 * directo de Meta, ni contesta nada por su cuenta.
 *
 * Best-effort: cualquier error acá se loguea y se descarta, nunca debe
 * interrumpir el flujo real de Instagram.
 */

type ChatwootConfig = {
  baseUrl: string;
  accountId: string;
  inboxId: number;
  accessToken: string;
};

function getConfig(): ChatwootConfig | null {
  const baseUrl = process.env.CHATWOOT_BASE_URL;
  const accountId = process.env.CHATWOOT_ACCOUNT_ID;
  const inboxId = process.env.CHATWOOT_INBOX_ID;
  const accessToken = process.env.CHATWOOT_ACCESS_TOKEN;

  if (!baseUrl || !accountId || !inboxId || !accessToken) return null;
  return { baseUrl, accountId, inboxId: Number(inboxId), accessToken };
}

async function chatwootFetch(cfg: ChatwootConfig, path: string, init?: RequestInit) {
  const response = await fetch(`${cfg.baseUrl}/api/v1/accounts/${cfg.accountId}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      api_access_token: cfg.accessToken,
      ...(init?.headers ?? {}),
    },
  });

  const texto = await response.text();
  const datos = texto ? JSON.parse(texto) : null;

  if (!response.ok) {
    throw new Error(`Chatwoot API ${response.status}: ${texto}`);
  }
  return datos;
}

async function obtenerOCrearContacto(cfg: ChatwootConfig, igsid: string): Promise<number> {
  const busqueda = await chatwootFetch(cfg, `/contacts/search?q=${encodeURIComponent(igsid)}`);
  const existente = (busqueda?.payload ?? []).find((c: { identifier: string }) => c.identifier === igsid);
  if (existente) return existente.id;

  const creado = await chatwootFetch(cfg, `/contacts`, {
    method: "POST",
    body: JSON.stringify({
      inbox_id: cfg.inboxId,
      name: igsid,
      identifier: igsid,
    }),
  });
  return creado.payload.contact.id;
}

async function obtenerOCrearConversacion(cfg: ChatwootConfig, contactId: number): Promise<number> {
  const conversaciones = await chatwootFetch(cfg, `/contacts/${contactId}/conversations`);
  const existente = (conversaciones?.payload ?? []).find(
    (c: { inbox_id: number }) => c.inbox_id === cfg.inboxId,
  );
  if (existente) return existente.id;

  const creada = await chatwootFetch(cfg, `/conversations`, {
    method: "POST",
    body: JSON.stringify({
      source_id: `instagram-${contactId}`,
      inbox_id: cfg.inboxId,
      contact_id: contactId,
    }),
  });
  return creada.id;
}

/**
 * Manda una copia del mensaje (entrante del cliente, o saliente de la IA) a
 * la conversación de Chatwoot de ese IGSID — crea el contacto/conversación si
 * es la primera vez. No lanza excepciones: si Chatwoot no está configurado
 * (faltan las env vars CHATWOOT_*) o falla la llamada, solo lo loguea.
 */
export async function espejarMensajeInstagramChatwoot(
  igsid: string,
  texto: string,
  direccion: "incoming" | "outgoing",
) {
  const cfg = getConfig();
  if (!cfg) return; // Chatwoot no configurado — no-op silencioso
  if (!texto) return;

  try {
    const contactId = await obtenerOCrearContacto(cfg, igsid);
    const conversationId = await obtenerOCrearConversacion(cfg, contactId);
    await chatwootFetch(cfg, `/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: texto, message_type: direccion }),
    });
  } catch (error) {
    console.error("[chatwoot] Error espejando mensaje:", error instanceof Error ? error.message : error);
  }
}
