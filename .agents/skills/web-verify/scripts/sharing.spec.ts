import { afterEach, expect, it } from 'vitest';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sharing } from './sharing.ts';

const folders: string[] = [];
const original = process.env.DEVELOPMENT_PREVIEW_HELPER;
afterEach(() => {
  if (original === undefined)
    Reflect.deleteProperty(process.env, 'DEVELOPMENT_PREVIEW_HELPER');
  else process.env.DEVELOPMENT_PREVIEW_HELPER = original;
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});
function fixture(answer: unknown, code = 0) {
  const folder = mkdtempSync(join(tmpdir(), 'web-sharing-'));
  folders.push(folder);
  const helper = join(folder, 'helper');
  writeFileSync(
    helper,
    `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(join(folder, 'arguments'))}, JSON.stringify(process.argv.slice(2))); process.stdout.write(${JSON.stringify(JSON.stringify(answer))}); process.exit(${code});\n`,
  );
  chmodSync(helper, 0o700);
  process.env.DEVELOPMENT_PREVIEW_HELPER = helper;
  return folder;
}
it('shares the running local URL and retains the exact origin for the proxy', () => {
  const folder = fixture({
    status: 'protected',
    publicUrl: 'https://private.trycloudflare.com',
  });
  const output = sharing('start', folder, 'http://127.0.0.1:5183');
  expect(output).toContain(
    'developer preview https://private.trycloudflare.com',
  );
  expect(output).toContain(
    'sign in as preview with the saved preview password',
  );
  expect(readFileSync(join(folder, 'public-origin'), 'utf8')).toBe(
    'https://private.trycloudflare.com',
  );
  expect(JSON.parse(readFileSync(join(folder, 'arguments'), 'utf8'))).toEqual([
    'start',
    '--state-dir',
    join(folder, 'sharing'),
    '--owner',
    expect.any(String),
    '--url',
    'http://127.0.0.1:5183',
  ]);
});
it.each([
  { status: 'local-only', reason: 'password gate unavailable' },
  { status: 'protected' },
  { status: 'protected', publicUrl: 'http://public.example' },
])('refuses an unverified external preview: %j', (answer) => {
  const folder = fixture(answer);
  expect(() => sharing('start', folder, 'http://127.0.0.1:5183')).toThrow(
    'local-only:',
  );
});
it('refuses a nonzero helper even if its output claims protection', () => {
  const folder = fixture(
    { status: 'protected', publicUrl: 'https://private.trycloudflare.com' },
    1,
  );
  expect(() => sharing('start', folder, 'http://127.0.0.1:5183')).toThrow(
    'local-only:',
  );
});
it('uses the captured helper for cleanup when the caller environment changes', () => {
  const folder = fixture({
    status: 'protected',
    publicUrl: 'https://private.trycloudflare.com',
  });
  sharing('start', folder, 'http://127.0.0.1:5183');
  Reflect.deleteProperty(process.env, 'DEVELOPMENT_PREVIEW_HELPER');
  expect(sharing('stop', folder, 'http://127.0.0.1:5183')).toBe('');
  expect(JSON.parse(readFileSync(join(folder, 'arguments'), 'utf8'))).toEqual([
    'stop',
    '--state-dir',
    join(folder, 'sharing'),
    '--owner',
    expect.any(String),
  ]);
});
it('keeps a local-only instance stoppable without a sharing helper', () => {
  const folder = fixture({});
  Reflect.deleteProperty(process.env, 'DEVELOPMENT_PREVIEW_HELPER');
  expect(sharing('stop', folder, 'http://127.0.0.1:5183')).toBe('');
  expect(() => sharing('start', folder, 'http://127.0.0.1:5183')).toThrow(
    'local-only: set DEVELOPMENT_PREVIEW_HELPER',
  );
});
