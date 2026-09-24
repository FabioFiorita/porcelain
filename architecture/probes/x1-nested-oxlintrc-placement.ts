import type { Probe } from '../probe.ts';

export default {
  decision: 'X1',
  plants:
    'packages/.oxlintrc.json, a file directly under packages/ that the placement check used to skip',
  gate: 'arch',
  rule: 'code-outside-roots',
  edits: [
    {
      kind: 'create',
      path: 'packages/.oxlintrc.json',
      content: `{ "rules": {} }
`,
    },
  ],
} satisfies Probe;
