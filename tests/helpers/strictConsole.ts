import type { Page } from '@playwright/test';

/** Žinomi ne CRM triukšmai (React, plėtiniai, šaltinių žemėlapiai, PWA). */
export function isBenignConsoleText(text: string): boolean {
  const t = text.trim();
  if (/react devtools/i.test(t)) return true;
  if (/favicon/i.test(t) && /failed|404|err/i.test(t)) return true;
  if (/source map/i.test(t) && /failed|could not/i.test(t)) return true;
  if (/extension:\/\//i.test(t)) return true;
  if (/chunk-[\w-]+\.js/i.test(t) && /failed to load/i.test(t)) return true;
  if (/sw\.js|service worker|workbox/i.test(t) && /warn|error/i.test(t)) return true;
  return false;
}

/**
 * Renka `console.error` ir nepagautas `pageerror`. Pridėti iškart po `page` sukūrimo.
 */
export function attachStrictConsoleWatch(page: Page, failures: string[]): void {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isBenignConsoleText(text)) return;
    failures.push(`console.error: ${text}`);
  });
  page.on('pageerror', (err) => {
    failures.push(`pageerror: ${err.message}`);
  });
}

/** Pagrindinio meniu etiketės (Layout.tsx) — eilės tvarka navigacijai. */
export const MAIN_NAV_LABELS = [
  'Apžvalga',
  'Užsakymai',
  'Kalendorius',
  'Klientai',
  'Išlaidos',
  'Mokėjimai',
  'Daugiau',
  'Nustatymai',
] as const;
