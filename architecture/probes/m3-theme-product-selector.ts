import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants: 'the shared token package acquires a product selector',
  gate: 'arch',
  rule: 'theme-data-only:',
  edits: [
    {
      kind: 'append',
      path: 'packages/theme/src/tokens.css',
      content: '\n.button { color: red; }\n',
    },
  ],
} satisfies Probe;
