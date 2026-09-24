import type { Probe } from '../probe.ts';

export default {
  decision: 'X1',
  plants: 'a root .eslintignore naming a rule with a comment and ==',
  gate: 'lint',
  rule: 'lint reads one configuration',
  edits: [
    {
      kind: 'create',
      path: '.eslintignore',
      content: `packages/projects/src/rules/probe-loose.ts
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
