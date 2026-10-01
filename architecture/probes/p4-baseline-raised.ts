import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a new empty catch planted together with a baseline entry written to hold it',
  gate: 'web-lint',
  rule: 'style(web-baseline)',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/shared/lib/submit-form.ts',
      content:
        '\nexport function probeSwallow(run: () => void) {\n  try {\n    run();\n  } catch {}\n}\n',
    },
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '{',
      new: '{\n  "porcelain/web-no-empty-catch": {\n    "apps/web/src/shared/lib/submit-form.ts": 1\n  },',
    },
  ],
} satisfies Probe;
