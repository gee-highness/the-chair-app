// src/lib/availability.ts
//
// Turns a barber's weekly hours + that day's existing appointments into a
// list of bookable start times for a given service duration. Used by both
// the new GET (slot listing) and POST (booking — audit finding #9, "no
// double-booking check") on /api/t/[tenantSlug]/book, so a slot the GET
// shows as free is guaranteed to still be validated the same way at
// booking time.
import { DailyAvailability } from './types';

const SLOT_GRANULARITY_MIN = 15;

interface BookedRange {
  start: Date;
  end: Date;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * @param date A calendar day (local); only its Y/M/D are used.
 * @param dailyAvailability The barber's weekly hours.
 * @param serviceDurationMin Length of the service being booked.
 * @param booked Existing appointments for this barber on this day (as [start,end) ranges).
 * @param now Used to exclude past slots when `date` is today.
 */
export function computeAvailableSlots(
  date: Date,
  dailyAvailability: DailyAvailability[],
  serviceDurationMin: number,
  booked: BookedRange[],
  now: Date = new Date()
): Date[] {
  const dayOfWeek = date.getDay();
  const windows = dailyAvailability.filter((d) => d.dayOfWeek === dayOfWeek);
  if (windows.length === 0) return [];

  const slots: Date[] = [];

  for (const window of windows) {
    const windowStartMin = toMinutes(window.startTime);
    const windowEndMin = toMinutes(window.endTime);

    for (let startMin = windowStartMin; startMin + serviceDurationMin <= windowEndMin; startMin += SLOT_GRANULARITY_MIN) {
      const slotStart = new Date(date);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(startMin);
      const slotEnd = new Date(slotStart.getTime() + serviceDurationMin * 60_000);

      if (slotStart < now) continue; // don't offer past slots today

      const overlaps = booked.some((b) => slotStart < b.end && slotEnd > b.start);
      if (!overlaps) slots.push(slotStart);
    }
  }

  return slots;
}

/** Converts an appointment + its service duration into a [start, end) range for overlap checks. */
export function toBookedRange(dateTime: Date, durationMin: number): BookedRange {
  return { start: dateTime, end: new Date(dateTime.getTime() + durationMin * 60_000) };
}
