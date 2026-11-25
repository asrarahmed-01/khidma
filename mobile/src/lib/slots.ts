// Home-service visits are booked as 2-hour arrival windows, the way technicians plan routes.
export const SLOT_START_HOURS = [8, 10, 12, 14, 16, 18, 20] as const;
export const BOOKING_DAYS = 7;
/** A slot must start at least this far ahead so a technician can actually get there. */
export const MIN_LEAD_MINUTES = 60;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function slotStart(day: Date, hour: number): Date {
  const d = startOfDay(day);
  d.setHours(hour);
  return d;
}

export function isSlotAvailable(start: Date, now: Date): boolean {
  return start.getTime() - now.getTime() >= MIN_LEAD_MINUTES * 60 * 1000;
}

/** The next days that still have at least one bookable slot (today drops off late in the evening). */
export function bookableDays(now: Date, count = BOOKING_DAYS): Date[] {
  const days: Date[] = [];
  for (let offset = 0; days.length < count && offset <= count; offset++) {
    const day = startOfDay(now);
    day.setDate(day.getDate() + offset);
    if (SLOT_START_HOURS.some((hour) => isSlotAvailable(slotStart(day, hour), now))) days.push(day);
  }
  return days;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
