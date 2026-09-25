import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants: 'shared code creates a React context to pass client state around',
  gate: 'web-lint',
  rule: 'porcelain(web-no-context)',
  edits: [
    {
      kind: 'create',
      path: 'apps/web/src/shared/probe-context.ts',
      content:
        "import { createContext } from 'react';\n\nexport const ProbeContext = createContext('');\n",
    },
  ],
} satisfies Probe;
