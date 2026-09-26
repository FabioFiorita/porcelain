import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'a new loop in a view held by a web-views-no-loops entry added after the commit that introduced the rule',
  gate: 'web-lint',
  rule: 'style(web-baseline)',
  edits: [
    {
      kind: 'append',
      path: 'apps/web/src/features/files/views/file-editor.tsx',
      content:
        '\nexport function probeLabels(names: string[]) {\n  const labels: string[] = [];\n  for (const name of names) labels.push(name);\n  return labels;\n}\n',
    },
    {
      kind: 'replace',
      path: 'architecture/web-baseline.json',
      old: '    "apps/web/src/features/review/views/commit-form.tsx": 1,\n    "apps/web/src/features/review/views/file-navigation.tsx": 1,\n    "apps/web/src/features/review/views/patch-focus.ts": 3,',
      new: '    "apps/web/src/features/review/views/commit-form.tsx": 1,\n    "apps/web/src/features/files/views/file-editor.tsx": 1,\n    "apps/web/src/features/review/views/file-navigation.tsx": 1,\n    "apps/web/src/features/review/views/patch-focus.ts": 3,',
    },
  ],
} satisfies Probe;
