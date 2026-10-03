import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'a shared client rule imports native UI after leaving the web path',
  gate: 'lint',
  rule: 'porcelain(web-rules-are-pure)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/client/src/features/access/rules/pairing-link.ts',
      content: "import 'react-native';\n",
    },
  ],
} satisfies Probe;
