import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    "access/services/issue-pairing-service.ts: import { randomUUID } from 'node:crypto'; credential id from randomUUID() instead of idSource",
  gate: 'arch',
  rule: 'service-cannot-import-external:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.ts',
      old: "import { IdSource, SecretSource } from '@porcelain/kernel/ports';",
      new: `import { randomUUID } from 'node:crypto';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';`,
    },
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.ts',
      old: `              idSource.next(),
              secretSource.next(),`,
      new: `              randomUUID(),
              secretSource.next(),`,
    },
  ],
} satisfies Probe;
