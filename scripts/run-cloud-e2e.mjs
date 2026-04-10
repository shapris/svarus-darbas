#!/usr/bin/env node
/**
 * Paleidžia Playwright debesies smoke tik jei yra .env.cloud-e2e.local su VITE_SUPABASE_URL.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envFile = path.join(root, '.env.cloud-e2e.local');

if (!fs.existsSync(envFile)) {
  console.error(
    [
      '[test:cloud] Trūksta failo .env.cloud-e2e.local (šalia package.json).',
      '  1) nukopijuokite .env.cloud-e2e.example → .env.cloud-e2e.local',
      '  2) įrašykite tikrus VITE_SUPABASE_URL ir VITE_SUPABASE_ANON_KEY',
      '  3) npm run test:cloud',
    ].join('\n')
  );
  process.exit(1);
}

const raw = fs.readFileSync(envFile, 'utf8');
const hasUrl = /^VITE_SUPABASE_URL=\s*https?:\/\//m.test(raw);
const hasKey =
  /^VITE_SUPABASE_ANON_KEY=\s*(eyJ|[a-zA-Z0-9._-]{32,})/m.test(raw) ||
  /^VITE_SUPABASE_ANON_KEY=\s*\S{32,}/m.test(raw);

if (!hasUrl || !hasKey) {
  console.error(
    '[test:cloud] .env.cloud-e2e.local turi būti VITE_SUPABASE_URL (https://...) ir VITE_SUPABASE_ANON_KEY (≥32 simb.).'
  );
  process.exit(1);
}

const r = spawnSync('npx', ['playwright', 'test', '--config=playwright.cloud.config.ts'], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: { ...process.env },
});
process.exit(r.status ?? 1);
