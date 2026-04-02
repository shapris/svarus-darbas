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
const useFirebase = val('VITE_USE_FIREBASE', envFile).toLowerCase() === 'true';

console.log('Cloud readiness check');
console.log(`Project: ${root}`);
console.log(`Using backend mode: ${useFirebase ? 'firebase' : 'supabase'}`);

printSection('Frontend (Vercel) env');
const frontendRequired = useFirebase
  ? ['VITE_USE_FIREBASE', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID']
  : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

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

printSection('Result');
if (missingHard === 0) {
  console.log('READY No hard blockers found.');
  process.exit(0);
}
console.log(`BLOCKED Missing ${missingHard} required setting(s).`);
process.exit(2);
