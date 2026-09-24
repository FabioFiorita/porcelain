import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'contracts files.ts validates a path with the files domain rule instead of a kernel rule, the only rules contracts may share',
  gate: 'arch',
  rule: 'contract-imports-kernel-rules-only',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/contracts/src/files/files.ts',
      content: `import { isWorktreeRelativePath } from '../../../files/src/rules/index.ts';
export const probeRelativePath = isWorktreeRelativePath;
`,
    },
  ],
} satisfies Probe;
