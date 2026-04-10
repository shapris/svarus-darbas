import { spawnSync } from 'node:child_process';

const attempts = Math.max(1, parseInt(process.argv[2] || '2', 10));
const cmd = process.argv.slice(3);
if (cmd.length === 0) {
  console.error('usage: node scripts/retry-cmd.mjs <attempts> <command> [args...]');
  process.exit(2);
}

let last = 1;
const shell = process.platform === 'win32';
for (let i = 1; i <= attempts; i++) {
  const r = shell
    ? spawnSync(cmd.join(' '), { stdio: 'inherit', shell: true, env: process.env })
    : spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: false, env: process.env });
  last = r.status ?? 1;
  if (last === 0) process.exit(0);
  if (i < attempts) {
    console.error(`[retry-cmd] attempt ${i}/${attempts} failed (exit ${last}), retrying...`);
  }
}
process.exit(last);
