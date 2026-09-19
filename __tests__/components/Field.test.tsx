// __tests__/components/Field.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, Textarea, Select } from '@/components/ui/Field';

describe('Input', () => {
  it('associates the label with the input via htmlFor/id (accessible by label)', () => {
    render(<Input label="Email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows a required marker and sets the required attribute', () => {
    render(<Input label="Email" required value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeRequired();
  });

  it('shows an error message with role="alert" and marks the input aria-invalid', () => {
    render(<Input label="Email" error="Invalid email" value="" onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a hint, but hides it once an error is present (error takes priority)', () => {
    const { rerender } = render(<Input label="Email" hint="We'll never share this" value="" onChange={() => {}} />);
    expect(screen.getByText("We'll never share this")).toBeInTheDocument();

    rerender(<Input label="Email" hint="We'll never share this" error="Invalid" value="" onChange={() => {}} />);
    expect(screen.queryByText("We'll never share this")).not.toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('calls onChange as the user types', async () => {
    const onChange = vi.fn();
    render(<Input label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'A');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Textarea', () => {
  it('associates the label and accepts multiline text', async () => {
    const onChange = vi.fn();
    render(<Textarea label="Notes" value="" onChange={onChange} />);
    const textarea = screen.getByLabelText('Notes');
    expect(textarea.tagName).toBe('TEXTAREA');
    await userEvent.type(textarea, 'x');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Select', () => {
  it('associates the label and renders the given options', () => {
    render(
      <Select label="Category" value="a" onChange={() => {}}>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    );
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });

  it('reflects the selected value', () => {
    render(
      <Select label="Category" value="b" onChange={() => {}}>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    );
    expect(screen.getByLabelText('Category')).toHaveValue('b');
  });
});
