import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'a server adapter validates a path with the kernel rule; only packages/git may share the kernel rules among the gateways',
  gate: 'arch',
  rule: 'gateway-cannot-import-rule-api:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/changes/worktree-files.ts',
      content: `import { isRelativePath } from '@porcelain/kernel/rules';
export const probeRelativePath = isRelativePath;
`,
    },
  ],
} satisfies Probe;
