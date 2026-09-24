import type { Probe } from '../probe.ts';

export default {
  decision: 'X1',
  plants:
    'a .gitignore inside projects/src/rules hiding a rule with a comment and == from a directory walk',
  gate: 'lint',
  rule: 'porcelain(no-comments)',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/rules/.gitignore',
      content: `probe-loose.ts
`,
    },
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-loose.ts',
      content: `// compares loosely
export function probeLoose(left: string, right: string): boolean {
  return left == right;
}
`,
    },
  ],
} satisfies Probe;
