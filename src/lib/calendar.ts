// src/lib/calendar.ts
//
// A one-event iCalendar file so a customer can drop a booking into their
// phone's calendar. Text fields are escaped per RFC 5545.
function esc(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function calendarFile(title: string, startIso: string, minutes: number, where: string): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + minutes * 60000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Chair App//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${start.getTime()}-${esc(title).length}@the-chair-app`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    `LOCATION:${esc(where)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Triggers a browser download of the .ics file. */
export function downloadCalendarFile(title: string, startIso: string, minutes: number, where: string): void {
  const url = URL.createObjectURL(new Blob([calendarFile(title, startIso, minutes, where)], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointment.ics';
  a.click();
  URL.revokeObjectURL(url);
}
