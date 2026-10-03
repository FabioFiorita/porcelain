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
      old: "import type { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';",
      new: `import { randomUUID } from 'node:crypto';
import type { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';`,
    },
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.ts',
      old: `        this.idSource.next(),
        this.secretSource.next(),`,
      new: `        randomUUID(),
        this.secretSource.next(),`,
    },
  ],
} satisfies Probe;
