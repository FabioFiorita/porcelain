import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { temporaryRoot } from './temporary-root.ts';

it('allocates a canonical directory when the operating system temporary parent is a symlink', ({
  onTestFinished,
}) => {
  const root = mkdtempSync(join(temporaryRoot, 'canonical-parent-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const parent = join(root, 'parent');
  const alias = join(root, 'alias');
  mkdirSync(parent);
  symlinkSync(parent, alias, 'dir');
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { temporaryRoot } from ${JSON.stringify(new URL('./temporary-root.ts', import.meta.url).href)};
    const directory = mkdtempSync(join(temporaryRoot, 'identity-'));
    try {
      writeFileSync(join(directory, 'contents'), 'same directory');
      process.stdout.write([directory, realpathSync(directory), readFileSync(join(realpathSync(directory), 'contents'), 'utf8')].join('\\n'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  `,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: alias, TMP: alias, TEMP: alias },
    },
  );
  expect(child.status, child.stderr).toBe(0);
  const [directory, canonical, contents] = child.stdout.split('\n');
  expect(directory).toBe(canonical);
  expect(contents).toBe('same directory');
});
