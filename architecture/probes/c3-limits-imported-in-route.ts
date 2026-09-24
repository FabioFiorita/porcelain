import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'http/routes/files/edit-file.ts reads LIMITS directly instead of the limits the server settings pass in',
  gate: 'lint',
  rule: 'porcelain(limits-from-settings)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/http/routes/files/edit-file.ts',
      content: `import { LIMITS } from '../../../config/limits.ts';
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/files/edit-file.ts',
      old: 'bodyLimit: options.limits.editFileBodyBytes,',
      new: 'bodyLimit: LIMITS.http.editFileBodyBytes,',
    },
  ],
} satisfies Probe;
