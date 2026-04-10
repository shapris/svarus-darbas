#!/usr/bin/env node
/**
 * API smoke: tas pats kaip probe-api.ps1, bet veikia macOS/Linux/Windows per Node fetch.
 * Naudojimas: node scripts/probe-api.mjs [--local] [--base URL] [--front URL]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const argv = process.argv.slice(2);
const local = argv.includes('--local');
let base = '';
let front = '';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--base' && argv[i + 1]) {
    base = argv[++i];
  }
  if (argv[i] === '--front' && argv[i + 1]) {
    front = argv[++i];
  }
}

const env = loadEnv();
let urlBase = base.trim();
if (local) {
  const port = process.env.PORT || '3001';
  urlBase = `http://127.0.0.1:${port}`;
}
if (!urlBase) {
  urlBase = (env.VITE_INVOICE_API_BASE_URL || '').trim().replace(/\/$/, '');
}
if (!urlBase) {
  urlBase = 'https://svarus-darbas-api.onrender.com';
}

async function get(path) {
  const u = `${urlBase}${path}`;
  const res = await fetch(u, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  return { u, status: res.status, text };
}

async function postJson(path, body) {
  const u = `${urlBase}${path}`;
  const res = await fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  return { u, status: res.status, text };
}

console.log('\n=== probe-api (node fetch) ===');
console.log('API base:', urlBase);

for (const p of ['/health', '/api/ai/health', '/api/client-service-requests']) {
  console.log(`\n--- GET ${p} ---`);
  try {
    const r = await get(p);
    console.log(r.u);
    console.log('HTTP', r.status);
    let out = r.text;
    if (out.length > 2000) out = out.slice(0, 2000) + '\n... (truncated)';
    if (r.status === 200 && out.trimStart().startsWith('{')) {
      try {
        out = JSON.stringify(JSON.parse(r.text), null, 2);
      } catch {
        /* raw */
      }
    }
    if (out) console.log(out);
  } catch (e) {
    console.error('ERR', e?.message || e);
  }
}

console.log('\n--- POST /api/ai/chat ---');
try {
  const r = await postJson('/api/ai/chat', {});
  console.log(r.u);
  console.log('HTTP', r.status);
  if (r.text && r.text.length < 800) console.log(r.text);
  else if (r.text) console.log(r.text.slice(0, 600) + '...');
} catch (e) {
  console.error('ERR', e?.message || e);
}

const frontUrl = front.trim().replace(/\/$/, '');
if (frontUrl) {
  console.log('\n--- GET CRM (--front) ---');
  try {
    const res = await fetch(`${frontUrl}/`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
    console.log(`${frontUrl}/`);
    console.log('HTTP', res.status);
  } catch (e) {
    console.error('ERR', e?.message || e);
  }
}

console.log('\nDone.\n');
