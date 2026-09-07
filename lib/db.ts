import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type ConversationMessage = { role: "user" | "assistant"; content: string };

let sql: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está configurado");
    sql = neon(url);
  }
  return sql;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaReady) {
    const db = getSql();
    schemaReady = (async () => {
      await db`
        create table if not exists conversations (
          sender_id text primary key,
          messages jsonb not null default '[]'::jsonb,
          updated_at timestamptz not null default now()
        )
      `;
      await db`
        create table if not exists bookings (
          id bigserial primary key,
          sender_id text not null,
          service text,
          starts_at timestamptz not null,
          ends_at timestamptz not null,
          calendar_event_id text,
          created_at timestamptz not null default now()
        )
      `;
      await db`
        alter table bookings add column if not exists status text not null default 'confirmed'
      `;
    })();
  }
  return schemaReady;
}

const MAX_HISTORY_MESSAGES = 20;

export async function getConversation(senderId: string): Promise<ConversationMessage[]> {
  await ensureSchema();
  const db = getSql();
  const rows = await db`select messages from conversations where sender_id = ${senderId}`;
  if (rows.length === 0) return [];
  return rows[0].messages as ConversationMessage[];
}

export async function saveConversation(senderId: string, messages: ConversationMessage[]) {
  await ensureSchema();
  const db = getSql();
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  await db`
    insert into conversations (sender_id, messages, updated_at)
    values (${senderId}, ${JSON.stringify(trimmed)}::jsonb, now())
    on conflict (sender_id) do update set messages = excluded.messages, updated_at = now()
  `;
}

export async function recordBooking(params: {
  senderId: string;
  service: string;
  startsAt: string;
  endsAt: string;
  calendarEventId: string;
}) {
  await ensureSchema();
  const db = getSql();
  await db`
    insert into bookings (sender_id, service, starts_at, ends_at, calendar_event_id)
    values (${params.senderId}, ${params.service}, ${params.startsAt}, ${params.endsAt}, ${params.calendarEventId})
  `;
}

export type Booking = {
  id: string;
  service: string;
  startsAt: string;
  endsAt: string;
  calendarEventId: string;
};

export async function getActiveBookings(senderId: string): Promise<Booking[]> {
  await ensureSchema();
  const db = getSql();
  const rows = await db`
    select id, service, starts_at, ends_at, calendar_event_id
    from bookings
    where sender_id = ${senderId} and status = 'confirmed'
    order by starts_at asc
  `;
  return rows.map((r) => ({
    id: String(r.id),
    service: r.service,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    calendarEventId: r.calendar_event_id,
  }));
}

export async function updateBooking(id: string, params: { startsAt: string; endsAt: string }) {
  await ensureSchema();
  const db = getSql();
  await db`
    update bookings set starts_at = ${params.startsAt}, ends_at = ${params.endsAt}
    where id = ${id}
  `;
}

export async function cancelBooking(id: string) {
  await ensureSchema();
  const db = getSql();
  await db`update bookings set status = 'cancelled' where id = ${id}`;
}
