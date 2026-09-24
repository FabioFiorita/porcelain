import type { Probe } from '../probe.ts';

export default {
  decision: 'V3',
  plants:
    'http/routes/changes/read-changes.ts: handler block `const { worktreeId } = request.params;` then the use-case call',
  gate: 'lint',
  rule: 'porcelain(feature-route-handler)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/routes/changes/read-changes.ts',
      old: `    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),`,
      new: `    async (request) => {
      const { worktreeId } = request.params;
      return options.useCase.execute(
        { worktreeId },
        { signal: request.disconnected },
      );
    },`,
    },
  ],
} satisfies Probe;
