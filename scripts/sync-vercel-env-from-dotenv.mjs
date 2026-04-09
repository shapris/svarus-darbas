#!/usr/bin/env node
/**
 * One-shot: nukopijuoja pasirinktus VITE_* kintamuosius iš `.env` į Vercel.
 *
 * Svarbu (Vercel CLI): `preview` env dažnai reikalauja Git šakos (3-as pozicinis argumentas) ir
 * negali taikytis prie „production branch“ (pvz. `main`). Jei remote yra tik `main`,
 * šis skriptas automatiškai praleidžia `preview` (nebent nustatysite `VERCEL_PREVIEW_BRANCHES`).
 *
 * Nenaudoti CI — tik lokaliai su `vercel login`.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const envPath = path.join(root, '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    // Nuimti optional viengubas/dvigubas kabutes aplink reikšmę (`.env` konvencija).
    if (
      (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
      (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function vercelEnvAdd({ name, value, environment, previewGitBranch }) {
  if (/[\r\n\0]/.test(String(value))) {
    throw new Error(`Refusing to sync ${name}: value contains control characters`);
  }

  // Windows: `.cmd` failų negalima `spawnSync` be `shell` (Node grąžina EINVAL).
  // `shell:true` + eksplicit quoting sumažina „kabutės įrašytos lokaliai“ ir netikėtus prompt'us.
  if (environment === 'preview' && !previewGitBranch) {
    throw new Error(`Internal error: preview requires previewGitBranch (${name})`);
  }

  let result;
  if (process.platform === 'win32') {
    // Svarbu: jei repo `node_modules` turi sugadintą `npx`, paprastas `npx` per `shell:true`
    // gali rezolvintis į lokalų ir iškart sukristi. Prefer'inam globalų Node.js `npx.cmd`.
    const candidates = ['C:\\Progra~1\\nodejs\\npx.cmd', 'C:\\Program Files\\nodejs\\npx.cmd'];
    const npxExecutable = candidates.find((p) => fs.existsSync(p)) || 'npx.cmd';

    const winCmdNeedsQuotes = (s) => /\s|[&^|<>()%!]/.test(String(s));
    const winCmdArg = (s) => {
      const str = String(s);
      if (!winCmdNeedsQuotes(str)) return str;
      return `"${str.replace(/"/g, '\\"')}"`;
    };
    const args = ['vercel', 'env', 'add', name, environment];
    if (previewGitBranch) args.push(previewGitBranch);
    args.push('--value', value, '--yes', '--force');
    if (environment !== 'development') args.push('--sensitive');

    // `spawnSync("C:\\Program Files\\...\\npx.cmd", ..., {shell:true})` Windows'e sulūžta (kelias perskirstomas ties tarpu).
    // Patikimas variantas: `cmd.exe /d /s /c` su pilnai su-quote'intu `npx.cmd` ir argumentais.
    const npxArg = winCmdArg(npxExecutable);
    const cmdLine = [npxArg, ...args.map(winCmdArg)].join(' ');
    result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', cmdLine], {
      // Jei `stdin` paveldimas iš TTY, kai kurie CLI gali „kabėti“ laukdamos input po sėkmingos operacijos.
      stdio: ['ignore', 'inherit', 'inherit'],
      cwd: root,
      windowsHide: true,
    });
  } else {
    const args = ['vercel', 'env', 'add', name, environment];
    if (previewGitBranch) args.push(previewGitBranch);
    args.push('--value', value, '--yes', '--force');
    if (environment !== 'development') args.push('--sensitive');
    result = spawnSync('npx', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      cwd: root,
      shell: false,
    });
  }

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const scope =
      environment === 'preview' && previewGitBranch
        ? `${environment}@${previewGitBranch}`
        : environment;
    throw new Error(`vercel env add failed for ${name} (${scope}) exit=${result.status}`);
  }
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function listPreviewGitBranchesFromRemote() {
  const result = spawnSync('git', ['branch', '-r'], { encoding: 'utf8', cwd: root, shell: false });
  if (result.status !== 0) {
    console.log('WARN Nepavyko nuskaityti `git branch -r` — praleidžiam Preview sinchronizaciją.');
    return [];
  }

  const productionBranches = new Set(['main', 'master']);
  const branches = [];
  for (const line of String(result.stdout || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.includes('->')) continue;
    // pvz. origin/feat/x
    const m = t.match(/^origin\/(.+)$/);
    if (!m) continue;
    const b = m[1].trim();
    if (!b) continue;
    if (productionBranches.has(b)) continue;
    branches.push(b);
  }
  return uniq(branches);
}

const env = parseEnvFile(envPath);

function isProbablyPlaceholder(value) {
  const v = String(value ?? '').trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (lower.includes('your_')) return true;
  if (lower.includes('pk_test_your')) return true;
  if (lower.includes('sk_test_your')) return true;
  if (lower === 'changeme') return true;
  return false;
}

function stripePublishableLooksValid(v) {
  return /^pk_(test|live)_[A-Za-z0-9]+$/.test(String(v).trim());
}

function googleMapsBrowserKeyLooksValid(v) {
  const s = String(v).trim();
  if (s.length < 24 || /\s/.test(s) || /[<>'"]/.test(s)) return false;
  if (s.startsWith('AIza')) return true;
  return /^[A-Za-z0-9._-]{32,}$/.test(s);
}

function assertValidOptionalForSync(key, value) {
  const v = String(value ?? '').trim();
  if (key === 'VITE_STRIPE_PUBLISHABLE_KEY' && !stripePublishableLooksValid(v)) {
    throw new Error(
      `${key}: netinkamas formatas — turi būti Stripe publishable (pk_test_… arba pk_live_…), kad sutaptų su Render STRIPE_SECRET_KEY režimu`
    );
  }
  if (key === 'VITE_GOOGLE_MAPS_API_KEY' && !googleMapsBrowserKeyLooksValid(v)) {
    throw new Error(
      `${key}: netinkamas formatas — įrašykite galiojantį Maps JavaScript API (naršyklės) raktą`
    );
  }
}

const mandatoryKeys = [
  'VITE_INVOICE_API_BASE_URL',
  'VITE_GEMINI_API_KEY',
  'VITE_OPENROUTER_API_KEY',
  'VITE_OPENCODE_API_KEY',
  'VITE_OPENCODE_VARIANT',
  'VITE_OPENCODE_MODEL',
];

// Optional frontend „vieši“ raktai — sinchronizuojami tik jei `.env` turi ne-placeholder reikšmę.
const optionalKeys = ['VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_GOOGLE_MAPS_API_KEY'];

for (const k of mandatoryKeys) {
  if (!String(env[k] ?? '').trim()) {
    throw new Error(`Missing ${k} in .env`);
  }
}

const keysToSync = [
  ...mandatoryKeys,
  ...optionalKeys.filter((k) => {
    const v = String(env[k] ?? '').trim();
    if (!v || isProbablyPlaceholder(v)) return false;
    try {
      assertValidOptionalForSync(k, v);
    } catch (e) {
      throw new Error(`${e?.message || e}\nPataisykite .env ir vėl paleiskite sinchronizaciją.`);
    }
    return true;
  }),
];

const previewBranches = uniq(
  String(process.env.VERCEL_PREVIEW_BRANCHES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);
const previewTargets = previewBranches.length
  ? previewBranches
  : listPreviewGitBranchesFromRemote();
if (!previewBranches.length && previewTargets.length === 0) {
  console.log(
    'INFO Preview sinchronizacija praleista: nerasta eligible remote Git šakų (tik `main/master` arba be `origin/*`).'
  );
  console.log(
    'INFO Jei naudojate Preview deploy šakas, nustatykite env `VERCEL_PREVIEW_BRANCHES=feat-1,feat-2` ir paleiskite dar kartą.'
  );
}

for (const k of keysToSync) {
  const value = String(env[k]).trim();
  vercelEnvAdd({ name: k, value, environment: 'production' });
  for (const branch of previewTargets) {
    vercelEnvAdd({ name: k, value, environment: 'preview', previewGitBranch: branch });
  }
  vercelEnvAdd({ name: k, value, environment: 'development' });
}

console.log(`OK Vercel env synced for: ${keysToSync.join(', ')}`);
