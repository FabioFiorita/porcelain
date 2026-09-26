import type { Probe } from '../probe.ts';

export default {
  decision: 'P30',
  plants:
    'list-directory-service.ts voids its signal parameter; if the plugin narrowed no-void-statement, this probe would go unrejected',
  gate: 'lint',
  rule: 'porcelain(no-void-statement)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '  ): Promise<ListDirectoryResult> {\n    const read',
      new: '  ): Promise<ListDirectoryResult> {\n    void signal;\n    const read',
    },
  ],
} satisfies Probe;
