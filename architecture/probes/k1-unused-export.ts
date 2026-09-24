import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants: 'kernel relative-path.ts exports a second rule that no file imports',
  gate: 'arch',
  rule: 'unused-export:',
  edits: [
    {
      kind: 'append',
      path: 'packages/kernel/src/rules/relative-path.ts',
      content: `
export function probeUnusedRule(path: string): boolean {
  return path === '';
}
`,
    },
  ],
} satisfies Probe;
