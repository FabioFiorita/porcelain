import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts: const check = readHealthResponseSchema.parse; return check({...})',
  gate: 'lint',
  rule: 'porcelain(use-case-imports)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: "import type { ReadHealthResponse } from '@porcelain/contracts/access';",
      new: `import {
  readHealthResponseSchema,
  type ReadHealthResponse,
} from '@porcelain/contracts/access';`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/access/read-health.ts',
      old: "    return { status: 'ok', environmentId };",
      new: `    const check = readHealthResponseSchema.parse;
    return check({ status: 'ok', environmentId });`,
    },
  ],
} satisfies Probe;
