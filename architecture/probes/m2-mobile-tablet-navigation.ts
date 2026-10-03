import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'tablet reuses the phone navigator',
  gate: 'lint',
  rule: 'porcelain(mobile-native-ui)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/mobile/src/shell/tablet-split.ios.tsx',
      content: "export { PhoneTabs } from './phone-tabs';\n",
    },
  ],
} satisfies Probe;
