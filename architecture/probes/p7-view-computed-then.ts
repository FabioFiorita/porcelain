import type { Probe } from '../probe.ts';

export default {
  decision: 'P7',
  plants:
    'a view sequences command completion with a computed Promise then property',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-promise-chains)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "export function probeSave(save: () => Promise<void>) {\n  void save()['then'](() => undefined);\n}\n",
    },
  ],
} satisfies Probe;
