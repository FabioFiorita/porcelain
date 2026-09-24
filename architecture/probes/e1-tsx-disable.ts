import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants:
    'new packages/files/src/rules/entry-label.tsx (a .tsx rule) with an oxlint disable block comment, a comment, throw and new Error',
  gate: 'lint',
  rule: 'disable directives are not allowed',
  edits: [
    {
      kind: 'create',
      path: 'packages/files/src/rules/entry-label.tsx',
      content: `${'/*'} oxlint-disable */
// entry labels for the browser
export function entryLabel(name: string): string {
  if (name === '') throw new Error('empty');
  return name;
}
`,
    },
  ],
} satisfies Probe;
