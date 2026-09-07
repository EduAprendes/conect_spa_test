// Huso horario fijo del negocio (no manejamos múltiples husos horarios).
export const UTC_OFFSET = process.env.BUSINESS_UTC_OFFSET || "-04:00";

export function offsetToMinutes(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}

/** "Ahora" del negocio, como si fuera UTC — permite usar los getters
 * `getUTC*` de Date para leer la hora local del negocio sin depender del
 * huso horario del servidor. */
export function businessNow(): Date {
  return new Date(Date.now() + offsetToMinutes(UTC_OFFSET) * 60_000);
}

/** Convierte una fecha/hora local del negocio (YYYY-MM-DD, HH:mm) a un
 * Date real (UTC) aplicando el offset del negocio. */
export function toBusinessDateTime(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00${UTC_OFFSET}`);
}
