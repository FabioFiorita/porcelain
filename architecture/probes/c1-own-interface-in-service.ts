import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'files/services/list-directory-service.ts: ListDirectoryOptions declared as an exported interface in the service file instead of imported from models/',
  gate: 'lint',
  rule: 'porcelain(interfaces-only-in-ports)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: `  ListDirectoryOptions,
`,
      new: '',
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: 'export class ListDirectoryService {',
      new: `export interface ListDirectoryOptions {
  maxEntries: number;
  maxResponseBytes: number;
}

export class ListDirectoryService {`,
    },
  ],
} satisfies Probe;
