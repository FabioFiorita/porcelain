import type { Probe } from '../probe.ts';

export default {
  decision: 'X2',
  plants:
    '.oxlintrc.json with "plugins": [], which silently drops every typescript rule',
  gate: 'lint',
  rule: '.oxlintrc.json differs from architecture/lint-config.json',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: `"plugins": [
    "typescript"
  ]`,
      new: `"plugins": []`,
    },
  ],
} satisfies Probe;
