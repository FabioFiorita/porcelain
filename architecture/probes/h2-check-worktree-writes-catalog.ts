import type { Probe } from '../probe.ts';

export default {
  decision: 'H2',
  plants:
    'projects check-worktree-service.ts saves the catalog while checking, so the check helper called before any lane writes',
  gate: 'arch',
  rule: 'lane-mode-matches-service:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/projects/src/services/check-worktree-service.ts',
      old: 'const entry = catalogCapability.find({\n            worktreeId: input.worktreeId,\n          });',
      new: 'const entry = catalogCapability.find({\n            worktreeId: input.worktreeId,\n          });\n          catalogCapability.save({ projects: [], listings: [] });',
    },
  ],
} satisfies Probe;
