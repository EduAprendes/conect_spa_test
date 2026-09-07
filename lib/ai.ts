import { generateText, tool, isStepCount, type ModelMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { createCalendarEvent } from "./calendar";
import { recordBooking, type ConversationMessage } from "./db";

let google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getModel() {
  if (!google) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY no está configurado");
    google = createGoogleGenerativeAI({ apiKey });
  }
  return google("gemini-3.8-flash");
}

// Offset fijo del negocio (no manejamos múltiples husos horarios).
const UTC_OFFSET = process.env.BUSINESS_UTC_OFFSET || "-04:00";
const DEFAULT_DURATION_MIN = 60;

function offsetToMinutes(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}

// Gemini no tiene noción de "hoy" — sin esto no puede resolver "mañana",
// "el viernes", etc. y termina volviendo a preguntar la fecha exacta.
function getFechaActualDelNegocio(): string {
  const shifted = new Date(Date.now() + offsetToMinutes(UTC_OFFSET) * 60_000);
  const fecha = shifted.toISOString().slice(0, 10);
  const hora = shifted.toISOString().slice(11, 16);
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(shifted);
  return `Hoy es ${dia} ${fecha} (formato AAAA-MM-DD) y son las ${hora} hs en el huso horario del negocio.`;
}

function buildSystemPrompt(): string {
  return `Sos el asistente de atención al cliente de Conect Spa por Instagram.
Respondé de forma breve, cordial y directa. Si no sabés algo, decilo con honestidad
en vez de inventar información.

${getFechaActualDelNegocio()} Cuando el cliente diga "hoy", "mañana", "pasado
mañana" o un día de la semana, calculá vos la fecha exacta en formato
AAAA-MM-DD a partir de esta referencia — no le vuelvas a preguntar la fecha
exacta si ya la podés calcular con esta información.

Cuando el cliente confirme un turno (servicio, fecha y hora concretos), llamá la
herramienta "crear_turno" con esos datos exactos. No la llames si todavía falta
algún dato — primero preguntá lo que falte. Después de que la herramienta
confirme, avisale al cliente la fecha y hora quedaron agendadas.`;
}

function buildTools(senderId: string) {
  return {
    crear_turno: tool({
      description:
        "Crea un turno confirmado en el calendario del spa. Usar solo cuando el cliente confirmó servicio, fecha y hora.",
      inputSchema: z.object({
        servicio: z.string().describe("Nombre del servicio o tratamiento"),
        nombreCliente: z.string().describe("Nombre del cliente"),
        fecha: z.string().describe("Fecha en formato YYYY-MM-DD"),
        horaInicio: z.string().describe("Hora de inicio en formato HH:mm (24hs)"),
        duracionMinutos: z
          .number()
          .optional()
          .describe("Duración del turno en minutos (por defecto 60)"),
      }),
      execute: async ({ servicio, nombreCliente, fecha, horaInicio, duracionMinutos }) => {
        const duration = duracionMinutos ?? DEFAULT_DURATION_MIN;
        const start = new Date(`${fecha}T${horaInicio}:00${UTC_OFFSET}`);
        const end = new Date(start.getTime() + duration * 60_000);

        const event = await createCalendarEvent({
          summary: `${servicio} - ${nombreCliente}`,
          description: `Turno agendado vía Instagram (sender_id: ${senderId})`,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
        });

        await recordBooking({
          senderId,
          service: servicio,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          calendarEventId: event.id ?? "",
        });

        return { confirmado: true, fecha, horaInicio, servicio };
      },
    }),
  };
}

export async function generateReply(
  senderId: string,
  history: ConversationMessage[],
  userMessage: string,
): Promise<string> {
  const messages: ModelMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: "user", content: userMessage },
  ];

  const { text } = await generateText({
    model: getModel(),
    system: buildSystemPrompt(),
    messages,
    tools: buildTools(senderId),
    stopWhen: isStepCount(4),
  });

  return text;
}
