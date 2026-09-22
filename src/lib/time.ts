/** Hotel timezone helpers (Charlotte) */

export const HOTEL_TZ = 'America/New_York';

export function dateKeyInHotelTz(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HOTEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: HOTEL_TZ,
    hour: 'numeric',
    minute: '2-digit',
  };
  const start = new Intl.DateTimeFormat('en-US', opts).format(new Date(startIso));
  const end = new Intl.DateTimeFormat('en-US', opts).format(new Date(endIso));
  return `${start} – ${end}`;
}

export function formatClock(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: HOTEL_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: HOTEL_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Combine YYYY-MM-DD + Excel time-of-day Date into ISO in hotel TZ */
export function combineDateAndExcelTime(
  dateKey: string,
  timeCell: Date | string | number,
): string {
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeCell instanceof Date) {
    // SheetJS cellDates: time-only serials become 1899-12-30T…Z — use UTC components
    hours = timeCell.getUTCHours();
    minutes = timeCell.getUTCMinutes();
    seconds = timeCell.getUTCSeconds();
  } else if (typeof timeCell === 'number') {
    const totalSeconds = Math.round(timeCell * 24 * 60 * 60);
    hours = Math.floor(totalSeconds / 3600) % 24;
    minutes = Math.floor((totalSeconds % 3600) / 60);
    seconds = totalSeconds % 60;
  } else {
    const m = String(timeCell).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (m) {
      hours = Number(m[1]);
      minutes = Number(m[2]);
      seconds = Number(m[3] ?? 0);
      const ap = m[4]?.toUpperCase();
      if (ap === 'PM' && hours < 12) hours += 12;
      if (ap === 'AM' && hours === 12) hours = 0;
    }
  }

  // Interpret wall clock in America/New_York
  const approx = new Date(`${dateKey}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
  // Adjust using formatter offset trick
  const asHotel = wallTimeToUtcIso(dateKey, hours, minutes, seconds);
  return asHotel || approx.toISOString();
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function wallTimeToUtcIso(
  dateKey: string,
  hours: number,
  minutes: number,
  seconds: number,
): string {
  // Binary-search UTC instant whose hotel-local components match
  const [y, mo, d] = dateKey.split('-').map(Number);
  let lo = Date.UTC(y, mo - 1, d - 1, 0, 0, 0);
  let hi = Date.UTC(y, mo - 1, d + 1, 23, 59, 59);
  const target = hours * 3600 + minutes * 60 + seconds;

  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = hotelParts(new Date(mid));
    const key = `${parts.y}-${pad(parts.mo)}-${pad(parts.d)}`;
    const secs = parts.h * 3600 + parts.mi * 60 + parts.s;
    if (key < dateKey || (key === dateKey && secs < target)) lo = mid + 1;
    else hi = mid;
  }
  const hit = new Date(lo);
  const p = hotelParts(hit);
  if (
    `${p.y}-${pad(p.mo)}-${pad(p.d)}` === dateKey &&
    p.h === hours &&
    p.mi === minutes
  ) {
    return hit.toISOString();
  }
  // Fallback: fixed offset guess EDT/EST
  return new Date(`${dateKey}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}-04:00`).toISOString();
}

function hotelParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: HOTEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    y: Number(map.year),
    mo: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    mi: Number(map.minute),
    s: Number(map.second),
  };
}

/** Calendar day from CITY Excel / CSV — never shift by hotel timezone. */
export function excelDateToDateKey(value: Date | string | number): string {
  if (value instanceof Date) {
    // SheetJS cellDates: calendar days are usually UTC midnight of that day
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number') {
    const utc = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    const y = utc.getUTCFullYear();
    const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const d = String(utc.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const isoDay = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (isoDay) return isoDay[1];
  // CITY exports often use M/D/YYYY
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (us) {
    return `${us[3]}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return s.slice(0, 10);
}

/** Map the current hotel clock time onto another calendar date (for schedule preview). */
export function hotelNowOnDate(dateKey: string, now = new Date()): Date {
  const p = hotelParts(now);
  const iso = wallTimeToUtcIso(dateKey, p.h, p.mi, p.s);
  return new Date(iso);
}
