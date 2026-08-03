import { describe, expect, it } from "vitest";
import { isOpenNow } from "./pharmacyHours";

// All reference times are constructed as UTC instants that correspond to a
// known Africa/Kigali (UTC+2, no DST) wall-clock time, since isOpenNow reads
// the Kigali-local day/hour/minute regardless of the machine's own timezone.
function kigaliTime(isoDateUtcMinus2: string): Date {
  return new Date(isoDateUtcMinus2);
}

describe("isOpenNow", () => {
  it("returns null when hours text is missing", () => {
    expect(isOpenNow(null)).toBeNull();
  });

  it("returns null for an unparseable format", () => {
    expect(isOpenNow("call for hours")).toBeNull();
  });

  it("returns true when within a Mon-Sat range, on a Monday, mid-day", () => {
    // 2026-06-01 is a Monday. 10:00 Kigali (UTC+2) = 08:00 UTC.
    expect(isOpenNow("Mon-Sat 08:00-20:00", kigaliTime("2026-06-01T08:00:00Z"))).toBe(true);
  });

  it("returns false when within a Mon-Sat range but on a Sunday", () => {
    // 2026-06-07 is a Sunday.
    expect(isOpenNow("Mon-Sat 08:00-20:00", kigaliTime("2026-06-07T08:00:00Z"))).toBe(false);
  });

  it("returns false before opening time on a valid day", () => {
    // Monday, 06:00 Kigali = 04:00 UTC — before an 08:00 opening.
    expect(isOpenNow("Mon-Sat 08:00-20:00", kigaliTime("2026-06-01T04:00:00Z"))).toBe(false);
  });

  it("returns false at/after closing time (end boundary exclusive)", () => {
    // Monday, 20:00 Kigali = 18:00 UTC — exactly closing time.
    expect(isOpenNow("Mon-Sat 08:00-20:00", kigaliTime("2026-06-01T18:00:00Z"))).toBe(false);
  });

  it("returns true right at opening time (start boundary inclusive)", () => {
    expect(isOpenNow("Mon-Sat 08:00-20:00", kigaliTime("2026-06-01T06:00:00Z"))).toBe(true);
  });

  it("treats 'Daily' as covering every day of the week", () => {
    // Sunday, mid-day.
    expect(isOpenNow("Daily 07:00-22:00", kigaliTime("2026-06-07T10:00:00Z"))).toBe(true);
  });

  it("is case-insensitive on day abbreviations", () => {
    expect(isOpenNow("mon-sat 08:00-20:00", kigaliTime("2026-06-01T08:00:00Z"))).toBe(true);
  });
});
