// __tests__/components/CustomerSignInModal.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerSignInModal } from '@/components/CustomerSignInModal';
import { renderWithToast } from '../helpers/testProviders';
import { mockFetch } from '../helpers/fetchMock';

const originalFetch = global.fetch;

describe('CustomerSignInModal', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders nothing when closed', () => {
    renderWithToast(<CustomerSignInModal open={false} onClose={() => {}} onSignedIn={() => {}} />);
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
  });

  it('starts on the email stage', () => {
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('"Send code" is disabled until an email is typed', () => {
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={() => {}} />);
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
  });

  it('requesting a code moves to the code stage and shows the dev code when returned', async () => {
    mockFetch({
      '/api/customer-auth/request': () => ({ json: { message: 'Code sent', devCode: '123456' } }),
    });
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={() => {}} />);

    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByRole('dialog', { name: 'Enter your code' });
    expect(screen.getByText(/Dev mode — your code is:/)).toHaveTextContent('123456');
  });

  it('does not show a dev code line when the API does not return one (production)', async () => {
    mockFetch({
      '/api/customer-auth/request': () => ({ json: { message: 'Code sent' } }), // no devCode
    });
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('dialog', { name: 'Enter your code' });
    expect(screen.queryByText(/Dev mode/)).not.toBeInTheDocument();
  });

  it('"Verify" is disabled until exactly 6 digits are entered', async () => {
    mockFetch({ '/api/customer-auth/request': () => ({ json: { message: 'ok' } }) });
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('dialog', { name: 'Enter your code' });

    const codeInput = screen.getByLabelText('Code');
    await userEvent.type(codeInput, '123');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await userEvent.type(codeInput, '456');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
  });

  it('the code field strips non-digit characters as they\'re typed', async () => {
    mockFetch({ '/api/customer-auth/request': () => ({ json: { message: 'ok' } }) });
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('dialog', { name: 'Enter your code' });

    const codeInput = screen.getByLabelText('Code');
    await userEvent.type(codeInput, '1a2b3c');
    expect(codeInput).toHaveValue('123');
  });

  it('a successful verify calls onSignedIn and resets to the email stage', async () => {
    mockFetch({
      '/api/customer-auth/request': () => ({ json: { message: 'ok', devCode: '654321' } }),
      '/api/customer-auth/verify': () => ({ json: { message: 'Signed in' } }),
    });
    const onSignedIn = vi.fn();
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={onSignedIn} />);

    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('dialog', { name: 'Enter your code' });
    await userEvent.type(screen.getByLabelText('Code'), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });

  it('an invalid code shows the error message and does NOT call onSignedIn', async () => {
    mockFetch({
      '/api/customer-auth/request': () => ({ json: { message: 'ok', devCode: '111111' } }),
      '/api/customer-auth/verify': () => ({ status: 401, json: { message: 'That code is invalid or has expired' } }),
    });
    const onSignedIn = vi.fn();
    renderWithToast(<CustomerSignInModal open onClose={() => {}} onSignedIn={onSignedIn} />);

    await userEvent.type(screen.getByLabelText('Email'), 'jamie@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('dialog', { name: 'Enter your code' });
    await userEvent.type(screen.getByLabelText('Code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(screen.getByText('That code is invalid or has expired')).toBeInTheDocument());
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
