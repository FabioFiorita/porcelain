import { expect, it } from 'vitest';
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

it('refuses to start when the Mac checkout has different native inputs', async () => {
  const local = await nativeFingerprint();

  const problems = await hostProblems(host, false, async () => ({
    fingerprint: 'mac-fingerprint',
    client: true,
  }));

  expect(problems).toContain(
    `the Mac checkout /Users/developer/porcelain has different native inputs (fingerprint mac-fingerprint) from this checkout (${local}); check out this commit there and run pnpm install, then ${build}`,
  );
});

it('refuses to start when the Mac has no development client for these native inputs', async () => {
  const local = await nativeFingerprint();

  const problems = await hostProblems(host, false, async () => ({
    fingerprint: local,
    client: false,
  }));

  expect(problems).toContain(
    `the Mac has no development client for this native fingerprint (${local}); native inputs changed since the last build, so ${build}`,
  );
});

it('refuses to start when the Mac cannot report its native inputs', async () => {
  const problems = await hostProblems(host, false, async () => ({
    failure: 'ssh: Could not resolve hostname mac',
  }));

  expect(problems).toContain(
    'the Mac checkout /Users/developer/porcelain could not report its native fingerprint over ssh mac: ssh: Could not resolve hostname mac',
  );
});

it('raises no native problem when the Mac has a client for the same native inputs', async () => {
  const local = await nativeFingerprint();

  const problems = await hostProblems(host, false, async () => ({
    fingerprint: local,
    client: true,
  }));

  expect(problems.filter((problem) => problem.includes('native'))).toEqual([]);
});
