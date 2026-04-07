/**
 * Pritaiko SQL failą prie Supabase Postgres per psql.
 * Reikia: .env → SUPABASE_DATABASE_URL (pilnas connection string su slaptažodžiu).
 * Įrankis: psql (PostgreSQL client — dažnai su PostgreSQL instaliacija arba Supabase CLI).
 *
 * Naudojimas:
 *   npm run db:apply-sql -- supabase/migrations/20260404200000_workspace_owner_team_access.sql
 */

import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

config({ path: resolve(process.cwd(), '.env') });

const url = process.env.SUPABASE_DATABASE_URL?.trim();
const fileArg = process.argv[2];

if (!url) {
  console.error(
    'Trūksta SUPABASE_DATABASE_URL .env faile.\n' +
      'Pavyzdys: postgresql://postgres:JUSU_SLAPT@db.<project-ref>.supabase.co:5432/postgres\n' +
      'Slaptažodyje simboliai @ # ir pan. — URL-enkodinkite (pvz. @ → %40).'
  );
  process.exit(1);
}

if (!fileArg) {
  console.error('Naudojimas: npm run db:apply-sql -- <kelias/iki/failo.sql>');
  process.exit(1);
}

const file = resolve(process.cwd(), fileArg);
if (!existsSync(file)) {
  console.error('Failas nerastas:', file);
  process.exit(1);
}

const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', file], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (r.error) {
  console.error(r.error.message);
  console.error(
    '\nĮsitikinkite, kad PATH turi psql (PostgreSQL „Command Line Tools“ arba https://www.postgresql.org/download/).'
  );
  process.exit(1);
}

process.exit(r.status === null ? 1 : r.status);
