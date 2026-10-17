// __tests__/components/PushToggle.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/Toast';
import { PushToggle } from '@/components/dashboard/PushToggle';

const originalFetch = global.fetch;

function stubBrowser(opts: { permission?: NotificationPermission; subscribed?: boolean }) {
  const subscription = { endpoint: 'https://push.example/x', toJSON: () => ({ endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn().mockResolvedValue(true) };
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(opts.subscribed ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  (window as any).PushManager = function () {};
  (window as any).Notification = Object.assign(function () {}, {
    permission: opts.permission ?? 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
  return { pushManager, subscription };
}

function stubFetch(publicKey: string | null) {
  const calls: any[] = [];
  global.fetch = vi.fn(async (url: any, init?: any) => {
    calls.push([String(url), init]);
    if (String(url).includes('/api/push/key')) return { ok: true, json: async () => ({ publicKey }) } as Response;
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  }) as any;
  return calls;
}

const renderIt = () => render(<ToastProvider><PushToggle /></ToastProvider>);

describe('PushToggle', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    delete (window as any).PushManager;
    delete (window as any).Notification;
  });

  it('renders nothing when the server has no push keys', async () => {
    stubBrowser({});
    stubFetch(null);
    const { container } = renderIt();
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('button')).toBeNull();
  });

  it('turns alerts on: asks permission, subscribes and tells the server', async () => {
    const { pushManager } = stubBrowser({});
    const calls = stubFetch('BPubKeyAAAA');
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));
    // The same words appear inline and in a toast, so look for the switch itself.
    expect(await screen.findByRole('button', { name: 'Turn off' })).toBeInTheDocument();
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    const post = calls.find((c) => c[0].includes('/api/push/subscribe') && c[1]?.method === 'POST');
    expect(JSON.parse(post[1].body).endpoint).toBe('https://push.example/x');
  });

  it('shows the on state for an existing subscription, and can turn it off', async () => {
    const { subscription } = stubBrowser({ permission: 'granted', subscribed: true });
    const calls = stubFetch('BPubKeyAAAA');
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(calls.some((c) => c[1]?.method === 'DELETE')).toBe(true);
    expect(await screen.findByRole('button', { name: 'Turn on alerts' })).toBeInTheDocument();
  });

  it('explains what to do when notifications are blocked', async () => {
    stubBrowser({ permission: 'denied' });
    stubFetch('BPubKeyAAAA');
    renderIt();
    expect(await screen.findByText('Booking alerts are blocked')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
