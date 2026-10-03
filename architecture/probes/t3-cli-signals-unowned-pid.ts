import type { Probe } from '../probe.ts';

export default {
  decision: 'T3',
  plants:
    'the control CLI core signals the recorded supervisor PID without reading its command line, so a reused PID kills an unrelated process',
  gate: 'integration',
  feature: 'verification-cli',
  rule: 'verification-cli.integration.ts > stop never signals a process whose command line is not the instance supervisor',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/server-verify/scripts/core/processes.ts',
      old: 'if (leader !== undefined && !leader.command.includes(marker))',
      new: "if (leader !== undefined && leader.command === '')",
    },
  ],
} satisfies Probe;
