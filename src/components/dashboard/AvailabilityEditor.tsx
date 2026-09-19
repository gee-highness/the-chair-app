// src/components/dashboard/AvailabilityEditor.tsx
'use client';
import styles from './AvailabilityEditor.module.css';

export interface DailyAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: DailyAvailability[];
  onChange: (next: DailyAvailability[]) => void;
}) {
  const byDay = new Map(value.map((d) => [d.dayOfWeek, d]));

  const toggleDay = (day: number, open: boolean) => {
    if (open) {
      onChange([...value, { dayOfWeek: day, startTime: '09:00', endTime: '17:00' }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    } else {
      onChange(value.filter((d) => d.dayOfWeek !== day));
    }
  };

  const updateTime = (day: number, field: 'startTime' | 'endTime', time: string) => {
    onChange(value.map((d) => (d.dayOfWeek === day ? { ...d, [field]: time } : d)));
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Weekly availability</span>
      <div className={styles.days}>
        {DAY_LABELS.map((dayLabel, day) => {
          const entry = byDay.get(day);
          const open = !!entry;
          return (
            <div key={day} className={styles.dayRow}>
              <label className={styles.dayToggle}>
                <input type="checkbox" checked={open} onChange={(e) => toggleDay(day, e.target.checked)} />
                <span>{dayLabel}</span>
              </label>
              {open && entry ? (
                <div className={styles.times}>
                  <input
                    type="time"
                    value={entry.startTime}
                    onChange={(e) => updateTime(day, 'startTime', e.target.value)}
                    aria-label={`${dayLabel} start time`}
                    className={styles.timeInput}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="time"
                    value={entry.endTime}
                    onChange={(e) => updateTime(day, 'endTime', e.target.value)}
                    aria-label={`${dayLabel} end time`}
                    className={styles.timeInput}
                  />
                </div>
              ) : (
                <span className={styles.closed}>Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
