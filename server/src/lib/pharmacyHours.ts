// Parses the free-text `pharmacies.hours` format this app seeds/expects:
// "<Daily|Xxx-Yyy> HH:MM-HH:MM", e.g. "Mon-Sat 08:00-20:00" or "Daily 07:00-22:00".
// Anything else (unrecognized format, or no hours on file) is treated as
// unknown — `null` — rather than guessed at as open or closed.

const DAY_ABBREVIATIONS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function dayIndex(abbr: string): number | null {
  const idx = DAY_ABBREVIATIONS.indexOf(abbr.toLowerCase().slice(0, 3));
  return idx === -1 ? null : idx;
}

interface ParsedHours {
  startDay: number;
  endDay: number;
  startMinutes: number;
  endMinutes: number;
}

const HOURS_PATTERN = /^(daily|[a-z]{3}(?:-[a-z]{3})?)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/i;

function parseHours(text: string): ParsedHours | null {
  const match = text.trim().match(HOURS_PATTERN);
  if (!match) return null;

  const [, dayPart, startHour, startMin, endHour, endMin] = match;

  let startDay: number;
  let endDay: number;
  if (dayPart.toLowerCase() === "daily") {
    startDay = 0;
    endDay = 6;
  } else {
    const [startAbbr, endAbbr] = dayPart.split("-");
    const start = dayIndex(startAbbr);
    const end = dayIndex(endAbbr ?? startAbbr);
    if (start === null || end === null) return null;
    startDay = start;
    endDay = end;
  }

  const startMinutes = Number(startHour) * 60 + Number(startMin);
  const endMinutes = Number(endHour) * 60 + Number(endMin);
  // No overnight-wrap support (e.g. "22:00-02:00") — not needed for this
  // app's placeholder data, and it would complicate the day-boundary check
  // below for no real benefit yet.
  if (startMinutes >= endMinutes) return null;

  return { startDay, endDay, startMinutes, endMinutes };
}

function isDayInRange(day: number, start: number, end: number): boolean {
  if (start <= end) return day >= start && day <= end;
  return day >= start || day <= end; // wraps, e.g. Fri-Mon
}

// `at` defaults to "now" but takes an explicit Date so tests don't depend on
// the wall clock. Kigali has no DST, but Intl.DateTimeFormat with an explicit
// IANA zone is used anyway rather than a hardcoded UTC+2 offset — it reads
// correctly regardless of the server's own timezone, with no new dependency.
export function isOpenNow(hoursText: string | null, at: Date = new Date()): boolean | null {
  if (!hoursText) return null;

  const parsed = parseHours(hoursText);
  if (!parsed) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Kigali",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  const day = dayIndex(weekday);
  if (day === null) return null;

  if (!isDayInRange(day, parsed.startDay, parsed.endDay)) return false;

  const minutesNow = Number(hour) * 60 + Number(minute);
  return minutesNow >= parsed.startMinutes && minutesNow < parsed.endMinutes;
}
