// __tests__/components/MultiImageUpload.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiImageUpload } from '@/components/ui/MultiImageUpload';
import { renderWithToast } from '../helpers/testProviders';
import { mockFetchOnce } from '../helpers/fetchMock';

const originalFetch = global.fetch;

describe('MultiImageUpload', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders one tile per existing value plus an "+ Add" tile', () => {
    const { container } = renderWithToast(<MultiImageUpload label="Portfolio" values={['a.jpg', 'b.jpg']} onChange={() => {}} />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
  });

  it('uploading a new file APPENDS to the existing values (does not replace them)', async () => {
    mockFetchOnce({ url: 'https://blob.example/c.jpg' }, 201);
    const onChange = vi.fn();
    const { container } = renderWithToast(<MultiImageUpload label="Portfolio" values={['a.jpg', 'b.jpg']} onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bytes'], 'c.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['a.jpg', 'b.jpg', 'https://blob.example/c.jpg']));
  });

  it('removing one photo keeps the others, in order', async () => {
    const onChange = vi.fn();
    renderWithToast(<MultiImageUpload label="Portfolio" values={['a.jpg', 'b.jpg', 'c.jpg']} onChange={onChange} />);
    const removeButtons = screen.getAllByRole('button', { name: 'Remove photo' });
    await userEvent.click(removeButtons[1]); // remove b.jpg
    expect(onChange).toHaveBeenCalledWith(['a.jpg', 'c.jpg']);
  });

  it('shows an error toast and does not append when the upload fails', async () => {
    mockFetchOnce({ message: 'File too large (max 5MB)' }, 400);
    const onChange = vi.fn();
    const { container } = renderWithToast(<MultiImageUpload label="Portfolio" values={[]} onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bytes'], 'huge.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(screen.getByText('File too large (max 5MB)')).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});
