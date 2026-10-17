// src/lib/ogCard.tsx
//
// The share-card layout used for a salon's and a barber's link previews
// (WhatsApp, iMessage, socials). Rendered by next/og at request time.
import { ImageResponse } from 'next/og';
import { onColor } from '@/lib/tenantTheme';

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard(opts: { eyebrow: string; title: string; subtitle?: string; color?: string; footer?: string; photo?: string }) {
  const bg = opts.color && /^#[0-9a-f]{6}$/i.test(opts.color) ? opts.color : '#0f2236';
  const fg = onColor(bg);
  return new ImageResponse(
    (
      <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', background: bg, color: fg, padding: 72, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: '#f0a068' }} />
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: opts.photo ? 700 : 1000 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', opacity: 0.75 }}>{opts.eyebrow}</div>
          <div style={{ fontSize: opts.title.length > 22 ? 76 : 96, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>{opts.title}</div>
          {opts.subtitle && <div style={{ fontSize: 36, opacity: 0.85, marginTop: 28, lineHeight: 1.3 }}>{opts.subtitle.slice(0, 120)}</div>}
          <div style={{ fontSize: 30, marginTop: 48, fontWeight: 600, opacity: 0.9 }}>{opts.footer || 'Book on The Chair App'}</div>
        </div>
        {opts.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={opts.photo} alt="" width={380} height={380} style={{ borderRadius: 190, objectFit: 'cover', border: `6px solid ${fg}` }} />
        )}
      </div>
    ),
    OG_SIZE
  );
}
