// src/lib/clashes.ts
//
// Finds bookings that overlap each other for the same barber, so the
// appointments board can warn staff. Only live bookings (pending/confirmed)
// hold a barber's time, the same rule the booking route uses.
export interface ClashCandidate {
  _id: string;
  barberId?: string;
  dateTime: string;
  status: string;
  serviceDuration?: number;
  customerName?: string;
}

const DEFAULT_DURATION_MIN = 30;

const isLive = (a: ClashCandidate) => a.status === 'pending' || a.status === 'confirmed';

/** Map of booking id -> the other live bookings it overlaps (same barber). Bookings with no clash are absent. */
export function findClashes<T extends ClashCandidate>(appointments: T[]): Map<string, T[]> {
  const byBarber = new Map<string, T[]>();
  for (const a of appointments) {
    if (!isLive(a) || !a.barberId) continue;
    const list = byBarber.get(a.barberId) || [];
    list.push(a);
    byBarber.set(a.barberId, list);
  }

  const result = new Map<string, T[]>();
  for (const list of byBarber.values()) {
    const ranges = list
      .map((a) => {
        const start = new Date(a.dateTime).getTime();
        return { a, start, end: start + (a.serviceDuration || DEFAULT_DURATION_MIN) * 60_000 };
      })
      .sort((x, y) => x.start - y.start);
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length && ranges[j].start < ranges[i].end; j++) {
        result.set(ranges[i].a._id, [...(result.get(ranges[i].a._id) || []), ranges[j].a]);
        result.set(ranges[j].a._id, [...(result.get(ranges[j].a._id) || []), ranges[i].a]);
      }
    }
  }
  return result;
}
