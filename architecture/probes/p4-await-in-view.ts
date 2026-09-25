import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view awaits a save itself',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-await)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export async function probeSave(save: () => Promise<void>) {\n  await save();\n}\n',
    },
  ],
} satisfies Probe;
