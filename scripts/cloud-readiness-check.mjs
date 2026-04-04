#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const envPath = path.join(root, '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    out[k] = v;
  }
  return out;
}

function val(key, envFile) {
  return String(process.env[key] ?? envFile[key] ?? '').trim();
}

function has(key, envFile) {
  return val(key, envFile).length > 0;
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

const envFile = parseEnvFile(envPath);

console.log('Cloud readiness check');
console.log(`Project: ${root}`);
console.log('Using backend mode: supabase');

printSection('Frontend (Vercel) env');
const frontendRequired = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

const frontendOptional = [
  'VITE_OPENROUTER_API_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_INVOICE_API_BASE_URL',
];

let missingHard = 0;
for (const k of frontendRequired) {
  const ok = has(k, envFile);
  if (!ok) missingHard += 1;
  console.log(`${ok ? 'OK  ' : 'MISS'} ${k}`);
}
for (const k of frontendOptional) {
  const ok = has(k, envFile);
  console.log(`${ok ? 'OK  ' : 'WARN'} ${k}`);
}

printSection('Backend API (server.cjs) env');
const backendRequired = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'];
const backendSupabase = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const backendCors = ['FRONTEND_URL', 'CORS_ORIGINS'];

for (const k of backendRequired) {
  const ok = has(k, envFile);
  if (!ok) missingHard += 1;
  console.log(`${ok ? 'OK  ' : 'MISS'} ${k}`);
}
for (const k of backendSupabase) {
  const ok = has(k, envFile) || has(`VITE_${k}`, envFile);
  if (!ok) missingHard += 1;
  console.log(`${ok ? 'OK  ' : 'MISS'} ${k} (or VITE_${k})`);
}
const serviceRoleOk = has('SUPABASE_SERVICE_ROLE_KEY', envFile);
if (!serviceRoleOk) missingHard += 1;
console.log(`${serviceRoleOk ? 'OK  ' : 'MISS'} SUPABASE_SERVICE_ROLE_KEY`);
const corsOk = backendCors.some((k) => has(k, envFile));
if (!corsOk) {
  missingHard += 1;
  console.log('MISS FRONTEND_URL / CORS_ORIGINS');
} else {
  console.log('OK   FRONTEND_URL / CORS_ORIGINS');
}

printSection('Security warnings');
const from = val('RESEND_FROM_EMAIL', envFile).toLowerCase();
if (from.includes('onboarding@resend.dev')) {
  console.log('WARN Using onboarding@resend.dev (test-only sender).');
}
if (has('VITE_STRIPE_SECRET_KEY', envFile)) {
  console.log('WARN VITE_STRIPE_SECRET_KEY is public to client build. Remove it from Vercel env.');
}

printSection('Supabase schema track');
console.log('INFO Canonical production track: owner_id + snake_case.');
console.log('INFO   Run: supabase/production_owner_id_schema.sql');
console.log('INFO   Then: supabase/public_booking_rpcs.sql');
console.log(
  'INFO Track B: uid + quoted camelCase from supabase/migrations/20250322120000_crm_schema.sql.'
);
console.log('INFO   This is legacy compatibility only; do not mix both tracks in one project.');
console.log('INFO Quick SQL check in Supabase SQL Editor:');
console.log(
  "INFO   SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='settings' AND column_name IN ('owner_id','uid') ORDER BY column_name;"
);
printSection('Payments persistence');
console.log(
  'INFO Payment/invoice API now expects DB-backed persistence via server.cjs + Supabase service role.'
);
console.log('INFO Required for production: SUPABASE_SERVICE_ROLE_KEY on the API host.');
console.log(
  'INFO Without it, server.cjs falls back to temporary in-memory storage and payment history is not durable.'
);

printSection('Result');
if (missingHard === 0) {
  console.log('READY No hard blockers found.');
  process.exit(0);
}
console.log(`BLOCKED Missing ${missingHard} required setting(s).`);
process.exit(2);
