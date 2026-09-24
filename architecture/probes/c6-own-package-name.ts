import type { Probe } from '../probe.ts';

export default {
  decision: 'C6',
  plants:
    "files/services/list-directory-service.ts: import type { DirectoryEntry } from '@porcelain/files/models'",
  gate: 'lint',
  rule: 'porcelain(imports-by-path)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: "import type { DirectoryEntry } from '../models/directory-entry.ts';",
      new: "import type { DirectoryEntry } from '@porcelain/files/models';",
    },
  ],
} satisfies Probe;
