import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view listens on window directly',
  gate: 'web-lint',
  rule: 'porcelain(web-listeners-in-adapters)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "export function probeListen(onResize: () => void) {\n  window.addEventListener('resize', onResize);\n}\n",
    },
  ],
} satisfies Probe;
