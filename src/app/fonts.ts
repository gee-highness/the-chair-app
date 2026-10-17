// src/app/fonts.ts
//
// One typeface, as in Servo: Space Grotesk for headings, body and numerals.
// Prices, times and queue numbers use tabular figures (see tokens.css) so
// columns line up without a separate monospace face.
import { Space_Grotesk } from 'next/font/google';

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const fontVariables = spaceGrotesk.variable;
