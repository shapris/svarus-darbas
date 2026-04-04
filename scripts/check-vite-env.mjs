/**
 * Tikrina ar .env / .env.local turi CRM paleidimui reikalingus VITE_* laukus (be raktų spausdinimo).
 * Paleidimas: npm run check:env
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
process.chdir(root);

const pEnv = path.join(root, '.env');
const pLocal = path.join(root, '.env.local');
if (fs.existsSync(pEnv)) loadDotenv({ path: pEnv });
if (fs.existsSync(pLocal)) loadDotenv({ path: pLocal, override: true });

function stripBom(s) {
  return s.replace(/^\uFEFF/, '').trim();
}

function env(name) {
  return stripBom(process.env[name] ?? '');
}

const url = env('VITE_SUPABASE_URL');
const anon = env('VITE_SUPABASE_ANON_KEY');
const offline =
  env('VITE_ALLOW_OFFLINE_CRM').toLowerCase() === 'true' ||
  env('VITE_DEMO_MODE').toLowerCase() === 'true';

const lines = [];

if (!fs.existsSync(pEnv) && !fs.existsSync(pLocal)) {
  console.error('❌ Nerastas .env nei .env.local. Sukurkite: copy .env.example .env ir užpildykite.');
  process.exit(1);
}

if (offline) {
  lines.push('ℹ️  VITE_ALLOW_OFFLINE_CRM arba VITE_DEMO_MODE = true → naudojamas vietinis CRM (debesies neprivaloma).');
  for (const l of lines) console.log(l);
  console.log('\n✅ check:env — offline režimui konfigūracija OK. Paleiskite: npm run dev');
  process.exit(0);
}

let ok = true;
if (!url) {
  lines.push('❌ Trūksta VITE_SUPABASE_URL');
  ok = false;
} else {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('blogas protokolas');
    lines.push('✓ VITE_SUPABASE_URL atrodo kaip URL');
  } catch {
    lines.push('❌ VITE_SUPABASE_URL nėra tinkamas http(s) adresas');
    ok = false;
  }
}
if (!anon || anon.length < 32) {
  lines.push('❌ VITE_SUPABASE_ANON_KEY per trumpas arba tuščias');
  ok = false;
} else {
  lines.push('✓ VITE_SUPABASE_ANON_KEY ilgis OK');
}

for (const l of lines) console.log(l);

if (ok) {
  console.log('\n✅ check:env — Supabase laukai tvarkoje. Paleiskite: npm run dev');
  process.exit(0);
}

console.error('\n❌ check:env — pataisykite .env ir vėl paleiskite npm run check:env');
process.exit(1);
