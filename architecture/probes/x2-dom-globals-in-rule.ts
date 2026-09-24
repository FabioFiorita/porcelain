import type { Probe } from '../probe.ts';

export default {
  decision: 'X2',
  plants:
    'DOM lib in the projects tsconfig and a rule using crypto.randomUUID(), performance.now() and console',
  gate: 'lint',
  rule: 'porcelain(no-node-globals)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/projects/tsconfig.json',
      old: `"types": []`,
      new: `"types": [],
    "lib": ["ES2024", "DOM"]`,
    },
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-stamp.ts',
      content: `export function probeStamp(): string {
  console.log(performance.now());
  return crypto.randomUUID();
}
`,
    },
  ],
} satisfies Probe;
