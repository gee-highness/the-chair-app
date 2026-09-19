// __tests__/components/AvailabilityEditor.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvailabilityEditor } from '@/components/dashboard/AvailabilityEditor';

describe('AvailabilityEditor', () => {
  it('shows "Closed" for a day with no entry, and time inputs for a day with one', () => {
    render(<AvailabilityEditor value={[{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }]} onChange={() => {}} />);
    expect(screen.getByLabelText('Monday start time')).toHaveValue('09:00');
    expect(screen.getByLabelText('Monday end time')).toHaveValue('17:00');
    // Sunday (day 0) has no entry.
    const sundayRow = screen.getByText('Sunday').closest('label')!.parentElement!;
    expect(sundayRow).toHaveTextContent('Closed');
  });

  it('checking a closed day\'s checkbox adds it with default 09:00-17:00 hours', async () => {
    const onChange = vi.fn();
    render(<AvailabilityEditor value={[]} onChange={onChange} />);
    const sundayCheckbox = screen.getByRole('checkbox', { name: 'Sunday' });
    await userEvent.click(sundayCheckbox);
    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00' }]);
  });

  it('unchecking an open day removes it and leaves other days untouched', async () => {
    const onChange = vi.fn();
    render(
      <AvailabilityEditor
        value={[
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
        ]}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(onChange).toHaveBeenCalledWith([{ dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }]);
  });

  it('changing a start/end time updates only that day\'s entry', async () => {
    const onChange = vi.fn();
    render(
      <AvailabilityEditor
        value={[
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
        ]}
        onChange={onChange}
      />
    );
    const mondayStart = screen.getByLabelText('Monday start time');
    fireEvent.change(mondayStart, { target: { value: '08:00' } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const monday = lastCall.find((d: any) => d.dayOfWeek === 1);
    const tuesday = lastCall.find((d: any) => d.dayOfWeek === 2);
    expect(monday.startTime).toBe('08:00');
    expect(tuesday).toEqual({ dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }); // untouched
  });

  it('adding a day keeps the list sorted by dayOfWeek', async () => {
    const onChange = vi.fn();
    render(<AvailabilityEditor value={[{ dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday' })); // day 1, added after day 3
    const result = onChange.mock.calls[0][0];
    expect(result.map((d: any) => d.dayOfWeek)).toEqual([1, 3]);
  });
});
