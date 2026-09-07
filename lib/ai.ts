import { generateText, tool, isStepCount, type ModelMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getBusyPeriods } from "./calendar";
import { getHuecosDisponibles } from "./availability";
import { businessNow, toBusinessDateTime } from "./timezone";
import { CATALOGO_SERVICIOS } from "./catalog";
import {
  recordBooking,
  getActiveBookings,
  updateBooking,
  cancelBooking,
  type ConversationMessage,
} from "./db";

let google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getModel() {
  if (!google) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY no está configurado");
    google = createGoogleGenerativeAI({ apiKey });
  }
  return google("gemini-3.8-flash");
}

const DEFAULT_DURATION_MIN = 60;

// Gemini no tiene noción de "hoy" — sin esto no puede resolver "mañana",
// "el viernes", etc. y termina volviendo a preguntar la fecha exacta.
function getFechaActualDelNegocio(): string {
  const shifted = businessNow();
  const fecha = shifted.toISOString().slice(0, 10);
  const hora = shifted.toISOString().slice(11, 16);
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(shifted);
  return `Hoy es ${dia} ${fecha} (formato AAAA-MM-DD) y son las ${hora} hs en el huso horario del negocio.`;
}

function buildSystemPrompt(): string {
  return `Sos el asistente de atención al cliente de Conect Spa por Instagram.
Respondé de forma breve, cordial y directa. Si no sabés algo, decilo con honestidad
en vez de inventar información.

Catálogo de servicios del spa (usalo para responder preguntas sobre
tratamientos, beneficios y precios — no inventes servicios ni precios que no
estén acá):

${CATALOGO_SERVICIOS}

${getFechaActualDelNegocio()} Cuando el cliente diga "hoy", "mañana", "pasado
mañana" o un día de la semana, calculá vos la fecha exacta en formato
AAAA-MM-DD a partir de esta referencia — no le vuelvas a preguntar la fecha
exacta si ya la podés calcular con esta información.

Si el cliente pregunta por disponibilidad, horarios libres, o qué días hay
turno, llamá "consultar_disponibilidad" en vez de inventar horarios — nunca
ofrezcas un horario sin haberlo consultado primero. Ofrecele solo 2 o 3
opciones concretas (no le tires la lista entera encima).

Cuando el cliente confirme un turno nuevo (servicio, fecha y hora concretos),
llamá la herramienta "crear_turno" con esos datos exactos. No la llames si
todavía falta algún dato — primero preguntá lo que falte. Si "crear_turno"
devuelve que el horario ya está ocupado, avisale y ofrecele consultar otros
horarios. Después de que la herramienta confirme, avisale al cliente que la
fecha y hora quedaron agendadas.

Si el cliente pide cambiar la fecha/hora de un turno ya agendado, llamá
"reagendar_turno". Si pide cancelarlo, llamá "cancelar_turno". Si esas
herramientas devuelven una lista de turnos para elegir (porque el cliente
tiene más de uno activo), mostrásela y preguntale cuál, pasando el "id" del
turno elegido en la siguiente llamada. Si devuelven que no hay turnos, avisale
al cliente en vez de inventar uno.`;
}

function calcularInicioYFin(fecha: string, horaInicio: string, duracionMinutos?: number) {
  const duration = duracionMinutos ?? DEFAULT_DURATION_MIN;
  const start = toBusinessDateTime(fecha, horaInicio);
  const end = new Date(start.getTime() + duration * 60_000);
  return { start, end };
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
        const { start, end } = calcularInicioYFin(fecha, horaInicio, duracionMinutos);

        const busy = await getBusyPeriods(start.toISOString(), end.toISOString());
        if (busy.length > 0) {
          return { error: "horario_ocupado", fecha, horaInicio };
        }

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

    consultar_disponibilidad: tool({
      description:
        "Consulta los horarios realmente libres en el calendario del spa entre dos fechas (máximo 14 días de rango). Usar siempre antes de ofrecer un horario.",
      inputSchema: z.object({
        fechaDesde: z.string().describe("Fecha de inicio de la búsqueda, formato YYYY-MM-DD"),
        fechaHasta: z.string().describe("Fecha de fin de la búsqueda (inclusive), formato YYYY-MM-DD"),
      }),
      execute: async ({ fechaDesde, fechaHasta }) => {
        const dias = await getHuecosDisponibles(fechaDesde, fechaHasta);
        if (dias.length === 0) return { sinDisponibilidad: true };
        return { dias };
      },
    }),

    reagendar_turno: tool({
      description:
        "Cambia la fecha/hora de un turno ya agendado del cliente. Si tiene más de un turno activo y no se pasó `id`, devuelve la lista para que el cliente elija.",
      inputSchema: z.object({
        id: z.string().optional().describe("Id del turno a reagendar, si ya se sabe cuál es"),
        nuevaFecha: z.string().describe("Nueva fecha en formato YYYY-MM-DD"),
        nuevaHora: z.string().describe("Nueva hora de inicio en formato HH:mm (24hs)"),
        duracionMinutos: z.number().optional(),
      }),
      execute: async ({ id, nuevaFecha, nuevaHora, duracionMinutos }) => {
        const activos = await getActiveBookings(senderId);
        if (activos.length === 0) return { error: "sin_turnos_activos" };

        const turno = id ? activos.find((b) => b.id === id) : activos.length === 1 ? activos[0] : undefined;

        if (!turno) {
          return {
            requiereSeleccion: true,
            turnos: activos.map((b) => ({ id: b.id, servicio: b.service, inicio: b.startsAt })),
          };
        }

        const { start, end } = calcularInicioYFin(nuevaFecha, nuevaHora, duracionMinutos);
        await updateCalendarEvent({
          eventId: turno.calendarEventId,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
        });
        await updateBooking(turno.id, { startsAt: start.toISOString(), endsAt: end.toISOString() });

        return { reagendado: true, servicio: turno.service, nuevaFecha, nuevaHora };
      },
    }),

    cancelar_turno: tool({
      description:
        "Cancela un turno ya agendado del cliente. Si tiene más de un turno activo y no se pasó `id`, devuelve la lista para que el cliente elija.",
      inputSchema: z.object({
        id: z.string().optional().describe("Id del turno a cancelar, si ya se sabe cuál es"),
      }),
      execute: async ({ id }) => {
        const activos = await getActiveBookings(senderId);
        if (activos.length === 0) return { error: "sin_turnos_activos" };

        const turno = id ? activos.find((b) => b.id === id) : activos.length === 1 ? activos[0] : undefined;

        if (!turno) {
          return {
            requiereSeleccion: true,
            turnos: activos.map((b) => ({ id: b.id, servicio: b.service, inicio: b.startsAt })),
          };
        }

        await deleteCalendarEvent(turno.calendarEventId);
        await cancelBooking(turno.id);

        return { cancelado: true, servicio: turno.service, inicio: turno.startsAt };
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
