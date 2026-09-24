import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "files/services/list-directory-service.ts: import type { Sign } from 'zodiac' (not zod; checks the prefix bug is gone)",
  gate: 'arch',
  rule: 'service-cannot-import-external',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: 'import { DirectoryTooLargeError }',
      new: `import type { Sign } from 'zodiac';
import { DirectoryTooLargeError }`,
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '  private readonly options: ListDirectoryOptions;',
      new: `  private readonly options: ListDirectoryOptions;
  private readonly sign: Sign | undefined = undefined;`,
    },
  ],
} satisfies Probe;
