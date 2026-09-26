import type { Probe } from '../probe.ts';

export default {
  decision: 'P7',
  plants: 'a view sequences command completion with Promise.finally',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-promise-chains)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        'export function probeSave(save: () => Promise<void>) {\n  void save().finally(() => undefined);\n}\n',
    },
  ],
} satisfies Probe;
