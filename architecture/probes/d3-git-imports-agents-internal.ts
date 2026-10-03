import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'git shared/commands/identity.ts imports an agents dto by path instead of the commit-planning entry',
  gate: 'arch',
  rule: 'agents-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/git/src/shared/commands/identity.ts',
      content:
        "import '../../../../agents/src/commit-planning/dtos/agent-limits.ts';\n",
    },
  ],
} satisfies Probe;
