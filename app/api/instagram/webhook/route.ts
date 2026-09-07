import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendInstagramMessage } from "@/lib/instagram";
import { generateReply } from "@/lib/ai";

// Evita procesar el mismo mensaje dos veces si Meta reintenta la entrega.
// Vive solo en memoria de la instancia: ayuda en el caso común, no es una
// garantía (una instancia nueva no la comparte).
const processedMessageIds = new Set<string>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!isValidSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      await handleMessagingEvent(event);
    }
  }

  // Meta espera un 200 rápido; el trabajo real ya se hizo arriba.
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

async function handleMessagingEvent(event: any) {
  const message = event.message;
  if (!message) return; // eventos como message_edit no traen `message`
  if (message.is_echo) return; // eco de mensajes enviados por esta misma app

  const mid = message.mid as string | undefined;
  if (mid) {
    if (processedMessageIds.has(mid)) return;
    processedMessageIds.add(mid);
  }

  const senderId = event.sender?.id;
  const text = message.text;
  if (!senderId || !text) return;

  try {
    const reply = await generateReply(text);
    if (reply) {
      await sendInstagramMessage(senderId, reply);
    }
  } catch (err) {
    console.error("[IG Webhook] error procesando mensaje", err);
  }
}

function isValidSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
