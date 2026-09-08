import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, test } from 'vitest';

function lint(path: string, source: string) {
  const root = mkdtempSync(join(tmpdir(), 'porcelain-vendor-lint-'));
  try {
    const config = JSON.parse(readFileSync('biome.json', 'utf8'));
    writeFileSync(
      join(root, 'biome.json'),
      JSON.stringify({
        ...config,
        vcs: { enabled: false },
      }),
    );
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
    return spawnSync(
      resolve('node_modules/.bin/biome'),
      ['lint', '--error-on-warnings', file],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('keeps vendor accessibility exceptions out of application components', () => {
  const source = 'export const control = <div role="button" />;';
  expect(lint('apps/web/src/components/ui/control.tsx', source).status).toBe(0);
  const application = lint('apps/web/src/components/control.tsx', source);
  expect(application.status).not.toBe(0);
  expect(application.stderr).toContain('useFocusableInteractive');
});

test('still rejects explicit any in vendored components', () => {
  const result = lint(
    'apps/web/src/components/ui/control.tsx',
    'export const value: any = 1;',
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('noExplicitAny');
});

test('rejects raw HTML injection in vendored components', () => {
  const result = lint(
    'apps/web/src/components/ui/content.tsx',
    'export function Content({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: html }} />; }',
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('noDangerouslySetInnerHtml');
});
