import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'use-cases/access/read-health.ts: readHealthResponseSchema.safeDecode({...})',
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
      new: `    const decoded = readHealthResponseSchema.safeDecode({ status: 'ok', environmentId });
    return decoded.success ? decoded.data : { status: 'ok', environmentId };`,
    },
  ],
} satisfies Probe;
