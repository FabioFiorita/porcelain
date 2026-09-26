import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'a view controls a dialog with an open prop instead of its handle',
  gate: 'web-lint',
  rule: 'porcelain(web-views-no-controlled-open)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import { Dialog } from '@/components/ui/dialog';\n\nexport function ProbeView(props: { shown: boolean }) {\n  return <Dialog open={props.shown} />;\n}\n",
    },
  ],
} satisfies Probe;
