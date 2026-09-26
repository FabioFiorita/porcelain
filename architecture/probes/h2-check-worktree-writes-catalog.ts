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
      old: `    const entry = this.catalog.find({ worktreeId: input.worktreeId });`,
      new: `    const entry = this.catalog.find({ worktreeId: input.worktreeId });
    this.catalog.save({ projects: [] });`,
    },
  ],
} satisfies Probe;
