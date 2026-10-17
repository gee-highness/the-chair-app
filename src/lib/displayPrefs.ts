// src/lib/displayPrefs.ts
//
// Reader preferences (theme, text size, contrast, motion), remembered on this
// device only. Shared by DisplayMenu and the pre-hydration script in the root
// layout so a saved choice is applied before first paint.

export interface DisplayPrefs {
  theme: 'system' | 'light' | 'dark';
  text: 'normal' | 'large' | 'xl';
  contrast: boolean;
  reduceMotion: boolean;
}

export const DISPLAY_PREFS_KEY = 'chair_display';

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  theme: 'system',
  text: 'normal',
  contrast: false,
  reduceMotion: false,
};

export function parseDisplayPrefs(raw: string | null): DisplayPrefs {
  try {
    const p = JSON.parse(raw || '{}');
    return {
      theme: ['system', 'light', 'dark'].includes(p.theme) ? p.theme : 'system',
      text: ['normal', 'large', 'xl'].includes(p.text) ? p.text : 'normal',
      contrast: p.contrast === true,
      reduceMotion: p.reduceMotion === true,
    };
  } catch {
    return DEFAULT_DISPLAY_PREFS;
  }
}

export function applyDisplayPrefs(p: DisplayPrefs, root: HTMLElement = document.documentElement) {
  if (p.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', p.theme);
  root.setAttribute('data-text', p.text);
  root.setAttribute('data-contrast', p.contrast ? 'high' : 'normal');
  root.setAttribute('data-motion', p.reduceMotion ? 'reduced' : 'normal');
}

/** Inline script run in <head>: same logic as applyDisplayPrefs, no imports. */
export const DISPLAY_PREFS_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('${DISPLAY_PREFS_KEY}')||'{}'),r=document.documentElement;if(p.theme==='light'||p.theme==='dark')r.setAttribute('data-theme',p.theme);if(p.text==='large'||p.text==='xl')r.setAttribute('data-text',p.text);if(p.contrast===true)r.setAttribute('data-contrast','high');if(p.reduceMotion===true)r.setAttribute('data-motion','reduced');}catch(e){}})();`;
