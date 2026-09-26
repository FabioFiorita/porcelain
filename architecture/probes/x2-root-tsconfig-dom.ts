import type { Probe } from '../probe.ts';

export default {
  decision: 'X2',
  plants: 'root tsconfig.json with the DOM lib, which every package inherits',
  gate: 'lint',
  rule: 'style(tsconfig)',
  edits: [
    {
      kind: 'replace',
      path: 'tsconfig.json',
      old: `    "lib": [
      "ES2024"
    ],`,
      new: `    "lib": [
      "ES2024",
      "DOM"
    ],`,
    },
  ],
} satisfies Probe;
