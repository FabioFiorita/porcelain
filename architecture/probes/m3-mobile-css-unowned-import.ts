import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants: 'the native CSS entry imports a second unowned styling system',
  gate: 'arch',
  rule: 'mobile-style-config:',
  edits: [
    {
      kind: 'append',
      path: 'apps/mobile/src/app.css',
      content: '\n@import "another-ui-library";\n',
    },
  ],
} satisfies Probe;
