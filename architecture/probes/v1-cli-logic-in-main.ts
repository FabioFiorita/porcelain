import type { Probe } from '../probe.ts';

export default {
  decision: 'V1',
  plants:
    'bootstrap/main.ts decides whether it is the entry point and runs the CLI itself',
  gate: 'lint',
  rule: 'porcelain(bootstrap-constructs-only)',
  edits: [
    {
      kind: 'append',
      path: 'apps/server/src/bootstrap/main.ts',
      content: `
if (import.meta.main) await cli.run();
`,
    },
  ],
} satisfies Probe;
