import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'http/routes/files/edit-file.ts sets its body limit to a literal 2048, a limit hiding beside the status codes the rule allows',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/files/edit-file.ts',
      old: 'bodyLimit: options.limits.editFileBodyBytes,',
      new: 'bodyLimit: 2048,',
    },
  ],
} satisfies Probe;
