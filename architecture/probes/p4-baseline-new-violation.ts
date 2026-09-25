import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a baselined file gains a finding of a rule the baseline does not hold for it',
  gate: 'web-lint',
  rule: 'porcelain(web-no-empty-catch)',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/review/views/file-editor.tsx',
      content:
        '\nexport function probeSwallow(run: () => void) {\n  try {\n    run();\n  } catch {}\n}\n',
    },
  ],
} satisfies Probe;
