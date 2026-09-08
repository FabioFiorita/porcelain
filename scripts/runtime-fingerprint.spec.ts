import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runtimeFingerprint } from './runtime-fingerprint.ts';

it('invalidates cached checks when effective Git configuration or SSH policy changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-runtime-proof-'));
  try {
    vi.stubEnv('HOME', root);
    vi.stubEnv('XDG_CONFIG_HOME', root);
    vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
    const initial = runtimeFingerprint();
    expect(runtimeFingerprint()).toBe(initial);
    writeFileSync(join(root, '.gitconfig'), '[core]\nignorecase = true\n');
    const configured = runtimeFingerprint();
    expect(configured).not.toBe(initial);
    vi.stubEnv('GIT_SSH_COMMAND', 'ssh -o BatchMode=yes');
    expect(runtimeFingerprint()).not.toBe(configured);
    expect(runtimeFingerprint()).toMatch(/^[a-f0-9]{64}$/);
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});
