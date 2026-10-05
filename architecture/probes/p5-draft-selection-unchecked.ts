import type { Probe } from '../probe.ts';

export default {
  decision: 'P5',
  plants:
    'the server returns whatever groups the coding tool drafts, even when they leave a selected path out',
  gate: 'integration',
  rule: 'git-actions-generate-commit-draft.integration.ts > a draft that leaves a selected path out, or a model the tool does not serve, is refused',
  feature: 'git-actions-generate-commit-draft',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git-actions/src/services/generate-commit-draft-service.ts',
      old: '!commitGroupsCoverSelection(\n              groups,\n              capture,\n              input.mode,\n              optionsCapability,\n            )',
      new: 'groups.length === 0',
    },
  ],
} satisfies Probe;
