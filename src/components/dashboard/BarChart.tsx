// src/components/dashboard/BarChart.tsx

/** "2026-10-12" reads as "12 Oct"; any other label is shown as it is. */
function shortLabel(label: unknown): string {
  const text = String(label ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return text;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function BarChart({
  data,
  valueKey,
  labelKey,
  height = 160,
  formatValue,
}: {
  data: Array<Record<string, any>>;
  valueKey: string;
  labelKey: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  const barWidth = data.length > 0 ? 100 / data.length : 0;
  // Few enough labels that none touch, even on a phone.
  const step = Math.max(1, Math.ceil(data.length / 5));
  // A chart with two or three days must not draw slab-sized bars.
  const drawn = Math.min(barWidth * 0.7, 6);

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, overflow: 'visible' }} role="img" aria-label="Bar chart">
        {data.map((d, i) => {
          const value = d[valueKey] || 0;
          const barHeight = (value / max) * (height - 24);
          return (
            <g key={i}>
              <rect
                x={i * barWidth + (barWidth - drawn) / 2}
                y={height - 24 - barHeight}
                width={drawn}
                height={barHeight}
                fill="var(--brass)"
                rx="1"
              >
                <title>{`${shortLabel(d[labelKey])}: ${formatValue ? formatValue(value) : value}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', height: '1.25rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, position: 'relative' }}>
            {i % step === 0 && (
              <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{shortLabel(d[labelKey])}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
