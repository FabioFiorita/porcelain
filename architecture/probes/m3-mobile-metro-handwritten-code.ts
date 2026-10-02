import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants:
    'the pinned Metro adapter hides handwritten code from type-aware lint',
  gate: 'arch',
  rule: 'mobile-style-config:',
  edits: [
    {
      kind: 'append',
      path: 'apps/mobile/metro.config.cjs',
      content: '\nrequire("node:fs").writeFileSync("escaped", "code");\n',
    },
  ],
} satisfies Probe;
