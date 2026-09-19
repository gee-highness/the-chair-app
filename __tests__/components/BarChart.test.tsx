// __tests__/components/BarChart.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BarChart } from '@/components/dashboard/BarChart';

describe('BarChart', () => {
  it('renders one <rect> bar per data point', () => {
    const { container } = render(
      <BarChart data={[{ day: 'Mon', bookings: 3 }, { day: 'Tue', bookings: 7 }, { day: 'Wed', bookings: 1 }]} valueKey="bookings" labelKey="day" />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });

  it('the bar for the maximum value is the tallest', () => {
    const { container } = render(
      <BarChart data={[{ day: 'Mon', bookings: 3 }, { day: 'Tue', bookings: 7 }, { day: 'Wed', bookings: 1 }]} valueKey="bookings" labelKey="day" height={160} />
    );
    const heights = Array.from(container.querySelectorAll('rect')).map((r) => parseFloat(r.getAttribute('height') || '0'));
    expect(Math.max(...heights)).toBe(heights[1]); // Tuesday (7) is tallest
  });

  it('renders no rects and does not throw for empty data', () => {
    const { container } = render(<BarChart data={[]} valueKey="bookings" labelKey="day" />);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('has an accessible role="img" label on the svg', () => {
    const { container } = render(<BarChart data={[{ day: 'Mon', bookings: 3 }]} valueKey="bookings" labelKey="day" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Bar chart');
  });
});
