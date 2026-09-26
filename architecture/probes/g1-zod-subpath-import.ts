import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "files/services/list-directory-service.ts: import { z } from 'zod/v4' (the real infrastructure module)",
  gate: 'lint',
  rule: 'porcelain(no-schema-parse-in-typed-code)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: 'import { DirectoryTooLargeError }',
      new: `import { z } from 'zod/v4';
import { DirectoryTooLargeError }`,
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: "    if (read.kind === 'failed')",
      new: `    z.string().parse(input.path);
    if (read.kind === 'failed')`,
    },
  ],
} satisfies Probe;
