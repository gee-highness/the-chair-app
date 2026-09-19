// src/app/fonts.ts
//
// Three-typeface system: Fraunces carries headline personality, Public Sans
// is the workhorse UI/body face (deliberately not Inter — see
// frontend-design skill notes on overused defaults), IBM Plex Mono sets
// every price/time/queue-number so numerals line up and read as data.
// Requires network at build time (Google Fonts) — same limitation noted in
// PROGRESS2.md; not verifiable in this sandbox.
import { Fraunces, Public_Sans, IBM_Plex_Mono } from 'next/font/google';

export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-public-sans',
  display: 'swap',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const fontVariables = `${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`;
