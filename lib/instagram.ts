import { espejarMensajeInstagramChatwoot } from "./chatwoot";

const GRAPH_BASE = "https://graph.instagram.com/v23.0";

export async function sendInstagramMessage(recipientId: string, text: string) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN no está configurado");

  const res = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram send failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  await espejarMensajeInstagramChatwoot(recipientId, text, "outgoing");
  return data;
}
