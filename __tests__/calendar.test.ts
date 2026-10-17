// __tests__/calendar.test.ts
import { describe, it, expect } from 'vitest';
import { calendarFile } from '@/lib/calendar';

describe('calendarFile', () => {
  it('builds a one-event iCalendar with start, end and escaped text', () => {
    const ics = calendarFile('Fade, with Alex; "VIP"', '2026-10-20T09:00:00.000Z', 45, 'Quano Locs\n12 Market St');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261020T090000Z');
    expect(ics).toContain('DTEND:20261020T094500Z');
    expect(ics).toContain('SUMMARY:Fade\\, with Alex\\; "VIP"');
    expect(ics).toContain('LOCATION:Quano Locs\\n12 Market St');
    expect(ics.split('\r\n').at(-1)).toBe('END:VCALENDAR');
  });
});
