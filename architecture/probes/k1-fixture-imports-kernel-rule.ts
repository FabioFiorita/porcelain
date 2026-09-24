import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'changes spec/fixtures/comparisons.ts imports a kernel rule; a sample builder takes only model types, from its own package or the kernel',
  gate: 'lint',
  rule: 'porcelain(fixture-imports)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/changes/spec/fixtures/comparisons.ts',
      content: `import { isRelativePath } from '@porcelain/kernel/rules';
export const probeRule = isRelativePath;
`,
    },
  ],
} satisfies Probe;
