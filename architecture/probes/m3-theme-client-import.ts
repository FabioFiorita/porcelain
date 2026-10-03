import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants: 'shared client behavior depends on presentation tokens',
  gate: 'arch',
  rule: 'theme-imports-stylesheets-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/api.ts',
      content: "import '@porcelain/theme/tokens.css';\n",
    },
  ],
} satisfies Probe;
