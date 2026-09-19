// src/components/dashboard/BarChart.tsx
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

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, overflow: 'visible' }} role="img" aria-label="Bar chart">
        {data.map((d, i) => {
          const value = d[valueKey] || 0;
          const barHeight = (value / max) * (height - 24);
          return (
            <g key={i}>
              <rect
                x={i * barWidth + barWidth * 0.15}
                y={height - 24 - barHeight}
                width={barWidth * 0.7}
                height={barHeight}
                fill="var(--brass)"
                rx="1"
              />
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', fontSize: '0.65rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {i % Math.ceil(data.length / 8 || 1) === 0 ? d[labelKey] : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
