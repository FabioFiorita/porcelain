import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'a feature view forwards generic props through a native button, duplicating the shadcn primitive',
  gate: 'web-lint',
  rule: 'porcelain(web-shadcn-wrapper)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/features/access/views/probe-view.tsx',
      content:
        "import type { ComponentProps } from 'react';\n\nexport function SaveControl(props: ComponentProps<'button'>) {\n  return <button {...props} />;\n}\n",
    },
  ],
} satisfies Probe;
