import type { Probe } from '../probe.ts';

export default {
  decision: 'M3',
  plants: 'Metro uses an unclassified native CSS entry',
  gate: 'arch',
  rule: 'mobile-style-config:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/mobile/metro.config.cjs',
      old: "cssEntryFile: './src/app.css'",
      new: "cssEntryFile: './src/unowned.css'",
    },
  ],
} satisfies Probe;
