import type { Probe } from '../probe.ts';

export default {
  decision: 'X2',
  plants: 'packages/projects/tsconfig.json with "lib": ["ES2024", "DOM"]',
  gate: 'lint',
  rule: 'style(tsconfig)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/projects/tsconfig.json',
      old: `"types": []`,
      new: `"types": [],
    "lib": ["ES2024", "DOM"]`,
    },
  ],
} satisfies Probe;
