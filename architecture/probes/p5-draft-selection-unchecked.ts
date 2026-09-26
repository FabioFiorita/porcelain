import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the server returns whatever groups the coding tool drafts, even when they leave a selected path out',
  gate: 'verify',
  rule: 'a draft that leaves a selected path out, or a model the tool does not serve: uncovered selection status',
  feature: 'git-actions.generate-commit-draft',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git-actions/src/services/generate-commit-draft-service.ts',
      old: '    if (!commitGroupsCoverSelection(groups, capture, input.mode, this.options))\n',
      new: '    if (groups.length === 0)\n',
    },
  ],
} satisfies Probe;
