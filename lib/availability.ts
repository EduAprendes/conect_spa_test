import { getBusyPeriods } from "./calendar";
import { businessNow, toBusinessDateTime } from "./timezone";

const SLOT_MINUTES = 60;

// Horario de atención del spa (hora local del negocio). 0 = domingo ... 6 = sábado.
const BUSINESS_HOURS: Record<number, [number, number] | null> = {
  0: null, // domingo, cerrado
  1: [9, 18],
  2: [9, 18],
  3: [9, 18],
  4: [9, 18],
  5: [9, 18],
  6: [9, 13],
};

const MAX_DAYS_AHEAD = 14;

function toLocalDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function overlaps(slotStart: Date, slotEnd: Date, busy: { start: string; end: string }[]): boolean {
  return busy.some((b) => slotStart < new Date(b.end) && slotEnd > new Date(b.start));
}

export type DiaConHuecos = { fecha: string; horas: string[] };

/**
 * Calcula los huecos libres entre `fechaDesde` y `fechaHasta` (YYYY-MM-DD,
 * inclusive), respetando el horario de atención y descartando horarios que
 * ya pasaron (si `fechaDesde` es hoy). Consulta el free/busy real de
 * Google Calendar — nunca inventa disponibilidad.
 */
export async function getHuecosDisponibles(
  fechaDesde: string,
  fechaHasta: string,
): Promise<DiaConHuecos[]> {
  const now = businessNow();
  const desde = new Date(`${fechaDesde}T00:00:00Z`);
  let hasta = new Date(`${fechaHasta}T00:00:00Z`);

  const limite = new Date(desde.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  if (hasta > limite) hasta = limite;

  const timeMin = toBusinessDateTime(fechaDesde, "00:00").toISOString();
  const timeMax = new Date(toBusinessDateTime(toLocalDateString(hasta), "00:00").getTime() + 24 * 60 * 60 * 1000).toISOString();
  const busy = await getBusyPeriods(timeMin, timeMax);

  const dias: DiaConHuecos[] = [];

  for (let cursor = new Date(desde); cursor <= hasta; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const fecha = toLocalDateString(cursor);
    const diaSemana = cursor.getUTCDay();
    const horario = BUSINESS_HOURS[diaSemana];
    if (!horario) continue; // cerrado ese día

    const [horaApertura, horaCierre] = horario;
    const horasDisponibles: string[] = [];

    for (let h = horaApertura; h < horaCierre; h++) {
      const horaStr = `${String(h).padStart(2, "0")}:00`;
      const slotStart = toBusinessDateTime(fecha, horaStr);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60_000);

      if (slotStart <= now) continue; // ya pasó
      if (overlaps(slotStart, slotEnd, busy)) continue; // ocupado

      horasDisponibles.push(horaStr);
    }

    if (horasDisponibles.length > 0) {
      dias.push({ fecha, horas: horasDisponibles });
    }
  }

  return dias;
}
