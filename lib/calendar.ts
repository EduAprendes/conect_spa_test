import { google } from "googleapis";

let calendarClient: ReturnType<typeof google.calendar> | null = null;

function getCalendarClient() {
  if (!calendarClient) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!email || !privateKey) {
      throw new Error(
        "Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      );
    }

    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    calendarClient = google.calendar({ version: "v3", auth });
  }
  return calendarClient;
}

export async function createCalendarEvent(params: {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
}) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID no está configurado");

  const calendar = getCalendarClient();
  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO },
      end: { dateTime: params.endISO },
    },
  });

  return data;
}

export async function updateCalendarEvent(params: {
  eventId: string;
  summary?: string;
  description?: string;
  startISO: string;
  endISO: string;
}) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID no está configurado");

  const calendar = getCalendarClient();
  const { data } = await calendar.events.patch({
    calendarId,
    eventId: params.eventId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO },
      end: { dateTime: params.endISO },
    },
  });

  return data;
}

export async function deleteCalendarEvent(eventId: string) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID no está configurado");

  const calendar = getCalendarClient();
  await calendar.events.delete({ calendarId, eventId });
}
