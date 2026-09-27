import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants: 'a root script calling the deprecated Zod string URL method',
  gate: 'lint',
  rule: 'typescript(no-deprecated)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-deprecated.ts',
      content:
        "import { z } from 'zod';\n\nexport function probeDeprecated() {\n  return z.string().url();\n}\n",
    },
  ],
} satisfies Probe;
