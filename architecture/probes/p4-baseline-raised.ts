import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a new empty catch planted together with a baseline raised to hold it',
  gate: 'web-lint',
  rule: 'style(web-baseline)',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/review/views/inline-composer.tsx',
      content:
        '\nexport function probeSwallow(run: () => void) {\n  try {\n    run();\n  } catch {}\n}\n',
    },
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '  "porcelain/web-no-empty-catch": {\n    "apps/web/src/app/workspace-provider.tsx": 1,\n    "apps/web/src/features/review/views/inline-composer.tsx": 1,\n',
      new: '  "porcelain/web-no-empty-catch": {\n    "apps/web/src/app/workspace-provider.tsx": 1,\n    "apps/web/src/features/review/views/inline-composer.tsx": 2,\n',
    },
  ],
} satisfies Probe;
