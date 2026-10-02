import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the server control CLI stops comparing the build fingerprint, so it drives an instance built from older server code',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'AssertionError: a stale build is refused',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/scripts/cli.ts',
      old: 'if (buildFingerprint() !== instance.fingerprint) {',
      new: "if (buildFingerprint() === '') {",
    },
  ],
} satisfies Probe;
