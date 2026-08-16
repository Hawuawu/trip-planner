export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM_RE = /^(\d{2}):(\d{2})$/;
const HMS_RE = /^(\d{2}):(\d{2}):(\d{2})$/;
const OFFSET_RE = /^[+-]\d{2}:\d{2}$/;

export interface OffsetDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offset: string; // "Z" or "+09:00"
}

// Parses an ISO 8601 datetime that carries its own explicit UTC offset,
// without ever routing through `new Date(...)` (which would reinterpret
// the string relative to the *viewer's* timezone).
export function parseOffsetDateTime(iso: string): OffsetDateTime {
  const tIndex = iso.indexOf('T');
  if (tIndex === -1) {
    throw new Error(`Expected an ISO 8601 timestamp with an explicit UTC offset, got: ${iso}`);
  }
  const datePart = iso.slice(0, tIndex);
  const timePart = iso.slice(tIndex + 1);
  const isZulu = timePart.endsWith('Z');
  const offset = isZulu ? 'Z' : timePart.slice(-6);
  const rawClockPart = isZulu ? timePart.slice(0, -1) : timePart.slice(0, -6);
  const dotIndex = rawClockPart.indexOf('.');
  const clockPart = dotIndex === -1 ? rawClockPart : rawClockPart.slice(0, dotIndex);

  const dateMatch = DATE_RE.exec(datePart);
  const clockMatch = HMS_RE.exec(clockPart) ?? HM_RE.exec(clockPart);
  const offsetValid = isZulu || OFFSET_RE.test(offset);

  if (!dateMatch || !clockMatch || !offsetValid) {
    throw new Error(`Expected an ISO 8601 timestamp with an explicit UTC offset, got: ${iso}`);
  }
  const [, year, month, day] = dateMatch;
  const [, hour, minute, second] = clockMatch;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? '0'),
    offset,
  };
}

export function extractOffset(iso: string): string {
  return parseOffsetDateTime(iso).offset;
}

// Freezes the wall-clock digits carried by an ISO string's own offset into
// a Date built via Date.UTC(...), so formatting with `timeZone: 'UTC'`
// reproduces those digits regardless of the viewer's real timezone.
function offsetWallClockAsUtcDate(iso: string): Date {
  const dt = parseOffsetDateTime(iso);
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second));
}

export function formatCheckpointTime(iso: string): string {
  return offsetWallClockAsUtcDate(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatCheckpointDate(iso: string): string {
  return offsetWallClockAsUtcDate(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function currentUtcOffsetString(): string {
  const offsetMin = -new Date().getTimezoneOffset(); // JS sign is inverted
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// Builds a Date from the local calendar components of a bare YYYY-MM-DD
// string. Never pass a bare date string to `new Date(...)` directly — that
// parses as UTC midnight and can roll the date back a day in negative-UTC-
// offset zones.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  while (cursor <= endDate) {
    days.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function localDayKey(isoDateTime: string): string {
  const dt = parseOffsetDateTime(isoDateTime);
  return `${dt.year}-${pad(dt.month)}-${pad(dt.day)}`;
}

export function formatDayLabel(dayKey: string): string {
  return parseLocalDate(dayKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
