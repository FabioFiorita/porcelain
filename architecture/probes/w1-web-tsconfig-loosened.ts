import type { Probe } from '../probe.ts';

export default {
  decision: 'W1',
  plants: 'apps/web/tsconfig.json turns strict off for the web',
  gate: 'lint',
  rule: 'style(tsconfig)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/tsconfig.json',
      old: '"jsx": "react-jsx",',
      new: '"jsx": "react-jsx",\n    "strict": false,',
    },
  ],
} satisfies Probe;
