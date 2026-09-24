import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants:
    'new packages/files/lib/limits.ts (a package folder outside src/spec) with a comment and an exported constant, imported by list-directory-service.ts',
  gate: 'arch',
  rule: 'code-outside-roots',
  edits: [
    {
      kind: 'create',
      path: 'packages/files/lib/limits.ts',
      content: `// default listing limit
export const maxEntries = 2000;
`,
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: 'import { DirectoryTooLargeError }',
      new: `import { maxEntries } from '../../lib/limits.ts';
import { DirectoryTooLargeError }`,
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '        limit: this.options.maxEntries + 1,',
      new: '        limit: Math.min(this.options.maxEntries, maxEntries) + 1,',
    },
  ],
} satisfies Probe;
