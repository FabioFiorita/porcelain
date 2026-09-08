import { spawnSync } from 'node:child_process';
import { runtimeFingerprint } from './runtime-fingerprint.ts';

const result = spawnSync('turbo', ['run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PORCELAIN_RUNTIME_FINGERPRINT: runtimeFingerprint() },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
