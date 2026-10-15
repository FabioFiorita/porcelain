import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { nativeFingerprint } from '@porcelain/mobile/kit/development-client';
import { hostProblems } from './host.ts';

const host = {
  hub: 'http://127.0.0.1:9',
  tokenVariable: 'PORCELAIN_HOST_SPEC_TOKEN',
  ports: [0, 0],
  ssh: 'mac',
  checkout: '/Users/developer/porcelain',
};
const build =
  'run .agents/skills/mobile-verify/scripts/cli build on the Mac in /Users/developer/porcelain (ssh mac)';

let local: string;
let directory: string;
let path: string | undefined;
beforeAll(async () => {
  local = await nativeFingerprint();
});
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-mobile-host-spec-'));
  path = process.env.PATH;
  process.env.PATH = `${directory}${delimiter}${path ?? ''}`;
});
afterEach(async () => {
  process.env.PATH = path;
  await rm(directory, { recursive: true, force: true });
});

async function mac(stdout: string, stderr = '', status = 0) {
  const calls = join(directory, 'calls.json');
  await writeFile(
    join(directory, 'ssh'),
    `#!${process.execPath}
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)));
process.stdout.write(${JSON.stringify(stdout)});
process.stderr.write(${JSON.stringify(stderr)});
process.exit(${status});
`,
    { mode: 0o700 },
  );
  return async () =>
    JSON.parse(await readFile(calls, 'utf8')) as readonly string[];
}

it('asks the Mac checkout for its native inputs and refuses when they differ', async () => {
  const calls = await mac(
    'mise notice\n{"fingerprint":"mac-fingerprint","client":true}\n',
  );

  const problems = await hostProblems(host, false);

  expect(problems).toContain(
    `the Mac checkout /Users/developer/porcelain has different native inputs (fingerprint mac-fingerprint) from this checkout (${local}); check out this commit there and run pnpm install, then ${build}`,
  );
  const args = await calls();
  expect(args).toContain('mac');
  expect(args.at(-1)).toContain("cd '/Users/developer/porcelain'");
  expect(args.at(-1)).toContain('{"action":"inspect"}');
});

it('refuses to start when the Mac has no development client for these native inputs', async () => {
  await mac(`{"fingerprint":"${local}","client":false}\n`);

  const problems = await hostProblems(host, false);

  expect(problems).toContain(
    `the Mac has no development client for this native fingerprint (${local}); native inputs changed since the last build, so ${build}`,
  );
});

it('refuses to start when the Mac cannot be reached', async () => {
  await mac('', 'ssh: Could not resolve hostname mac\n', 255);

  const problems = await hostProblems(host, false);

  expect(problems).toContain(
    'the Mac checkout /Users/developer/porcelain could not report its native fingerprint over ssh mac: ssh: Could not resolve hostname mac',
  );
});

it('refuses to start when the Mac answers without a fingerprint', async () => {
  await mac('Last login: today\n');

  const problems = await hostProblems(host, false);

  expect(problems).toContain(
    'the Mac checkout /Users/developer/porcelain could not report its native fingerprint over ssh mac: it answered without a fingerprint: Last login: today',
  );
});

it('raises no native problem when the Mac has a client for the same native inputs', async () => {
  await mac(`{"fingerprint":"${local}","client":true}\n`);

  const problems = await hostProblems(host, false);

  expect(problems.filter((problem) => problem.includes('native'))).toEqual([]);
});
