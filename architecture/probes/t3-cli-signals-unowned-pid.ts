import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core ignores the captured process start identity, so a reused PID with the same command kills an unrelated process',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'verification-cli.integration.ts > stop refuses a stale process identity even when its PID and command still match',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/verify-core/processes.ts',
      old: 'current.birth === captured.birth',
      new: 'true',
    },
  ],
} satisfies Probe;
