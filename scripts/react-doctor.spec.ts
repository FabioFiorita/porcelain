import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

test('the commit hook accepts clean React and rejects a staged hook violation', () => {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-doctor-'));
  const pnpm = resolve('node_modules/.bin/react-doctor');
  try {
    mkdirSync(join(root, 'apps/web/src'), { recursive: true });
    mkdirSync(join(root, '.husky'));
    writeFileSync(
      join(root, 'doctor.config.json'),
      readFileSync('doctor.config.json'),
    );
    writeFileSync(
      join(root, '.husky/pre-commit'),
      readFileSync('.husky/pre-commit'),
    );
    const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        private: true,
        scripts: {
          'doctor:staged': scripts['doctor:staged'].replace(
            'react-doctor',
            pnpm,
          ),
        },
      }),
    );
    writeFileSync(
      join(root, 'apps/web/package.json'),
      JSON.stringify({
        name: 'fixture-web',
        dependencies: { react: '19.2.8' },
      }),
    );
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    git(['init', '--quiet']);
    const file = join(root, 'apps/web/src/component.tsx');
    writeFileSync(file, 'export function Component() { return <p>Ready</p>; }');
    git(['add', '.']);
    const runHook = () =>
      spawnSync('sh', ['.husky/pre-commit'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, CI: 'true' },
      });
    const clean = runHook();
    expect(clean.status, clean.stdout + clean.stderr).toBe(0);
    writeFileSync(
      file,
      `import { useState } from 'react';
export function Component({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  const [value] = useState('Ready');
  return <p>{value}</p>;
}`,
    );
    git(['add', '.']);
    const invalid = runHook();
    expect(invalid.status, invalid.stdout + invalid.stderr).not.toBe(0);
    expect(invalid.stdout + invalid.stderr).toMatch(/hook|conditional/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
