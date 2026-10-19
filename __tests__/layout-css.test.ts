// __tests__/layout-css.test.ts
//
// Guards the one-line fix for the phone layout bug where the discovery page
// laid out ~900px wide on a 390px screen: page wrappers centred with
// `margin: 0 auto` inside the flex-column .app-root shrink-wrapped their
// content, so one wide rail widened the whole page and the phone zoomed out.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const tokens = fs.readFileSync(path.resolve(__dirname, '../src/styles/tokens.css'), 'utf-8');

describe('global layout rules', () => {
  it('makes direct children of .app-root fill the column (at zero specificity)', () => {
    expect(tokens).toMatch(/:where\(\.app-root > \*\)\s*\{\s*width:\s*100%;?\s*\}/);
  });
});
