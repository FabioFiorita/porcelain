import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants: 'the generated native declarations hide handwritten code from lint',
  gate: 'arch',
  rule: 'mobile-style-config:',
  edits: [
    {
      kind: 'append',
      path: 'apps/mobile/src/config/uniwind-types.d.ts',
      content: '\nexport const escaped: any;\n',
    },
  ],
} satisfies Probe;
