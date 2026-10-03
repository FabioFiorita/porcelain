import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core stops comparing the build fingerprint, so it drives an instance built from older server code',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'AssertionError: a stale build is refused',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/scripts/core/registry.ts',
      old: 'this.fingerprint() !== instance.fingerprint,',
      new: "this.fingerprint() === '',",
    },
  ],
} satisfies Probe;
