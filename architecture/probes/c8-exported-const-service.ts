import type { Probe } from '../probe.ts';

export default {
  decision: 'C8',
  plants:
    'files/services/list-directory-service.ts: export const DEFAULT_LIST_DIRECTORY_OPTIONS: ListDirectoryOptions = { maxEntries: this-style literals }',
  gate: 'lint',
  rule: 'porcelain(no-exported-constants)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: 'export class ListDirectoryService {',
      new: `export const LIST_DIRECTORY_KIND = 'directory';

export class ListDirectoryService {`,
    },
  ],
} satisfies Probe;
