// __tests__/components/TagInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagInput } from '@/components/ui/TagInput';

describe('TagInput', () => {
  it('renders existing tags as removable chips', () => {
    render(<TagInput label="Specialties" value={['Fades', 'Beard sculpting']} onChange={() => {}} />);
    expect(screen.getByText('Fades')).toBeInTheDocument();
    expect(screen.getByText('Beard sculpting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Fades' })).toBeInTheDocument();
  });

  it('pressing Enter commits the typed text as a new tag', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Specialties" value={[]} onChange={onChange} />);
    const input = screen.getByLabelText('Specialties');
    await userEvent.type(input, 'Fades{Enter}');
    expect(onChange).toHaveBeenCalledWith(['Fades']);
  });

  it('typing a comma commits the tag the same way as Enter', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Specialties" value={[]} onChange={onChange} />);
    const input = screen.getByLabelText('Specialties');
    await userEvent.type(input, 'Fades,');
    expect(onChange).toHaveBeenCalledWith(['Fades']);
  });

  it('does not add a duplicate tag', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Specialties" value={['Fades']} onChange={onChange} />);
    const input = screen.getByLabelText('Specialties');
    await userEvent.type(input, 'Fades{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking a chip\'s remove button removes just that tag', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Specialties" value={['Fades', 'Tapers']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Fades' }));
    expect(onChange).toHaveBeenCalledWith(['Tapers']);
  });

  it('Backspace on an empty input removes the last tag', async () => {
    const onChange = vi.fn();
    render(<TagInput label="Specialties" value={['Fades', 'Tapers']} onChange={onChange} />);
    const input = screen.getByLabelText('Specialties');
    input.focus();
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['Fades']);
  });

  it('blurring the input commits any typed draft text', async () => {
    const onChange = vi.fn();
    render(
      <div>
        <TagInput label="Specialties" value={[]} onChange={onChange} />
        <button>Elsewhere</button>
      </div>
    );
    const input = screen.getByLabelText('Specialties');
    await userEvent.type(input, 'Fades');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onChange).toHaveBeenCalledWith(['Fades']);
  });
});
