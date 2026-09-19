// __tests__/components/ImageUpload.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { renderWithToast } from '../helpers/testProviders';
import { mockFetchOnce } from '../helpers/fetchMock';

const originalFetch = global.fetch;

describe('ImageUpload', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows a placeholder and "Upload" button when there is no image yet', () => {
    renderWithToast(<ImageUpload label="Photo" value="" onChange={() => {}} />);
    expect(screen.getByText('no image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('shows the preview image and "Replace"/"Remove" buttons once a value is set', () => {
    renderWithToast(<ImageUpload label="Photo" value="https://example.test/a.jpg" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('clicking Remove calls onChange with an empty string', async () => {
    const onChange = vi.fn();
    renderWithToast(<ImageUpload label="Photo" value="https://example.test/a.jpg" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('selecting a file uploads it and calls onChange with the returned url', async () => {
    mockFetchOnce({ url: 'https://blob.example/new-photo.jpg' }, 201);
    const onChange = vi.fn();
    const { container } = renderWithToast(<ImageUpload label="Photo" value="" onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://blob.example/new-photo.jpg'));
  });

  it('shows an error toast when the upload fails, and does not call onChange', async () => {
    mockFetchOnce({ message: 'Unsupported file type' }, 400);
    const onChange = vi.fn();
    const { container } = renderWithToast(<ImageUpload label="Photo" value="" onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake-bytes'], 'photo.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => expect(screen.getByText('Unsupported file type')).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});
