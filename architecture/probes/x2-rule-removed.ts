import type { Probe } from '../probe.ts';

export default {
  decision: 'X2',
  plants:
    '.oxlintrc.json without typescript/no-explicit-any, and a rule returning any',
  gate: 'lint',
  rule: 'style(lint-config)',
  edits: [
    {
      kind: 'replace',
      path: '.oxlintrc.json',
      old: `    "typescript/no-explicit-any": "error",
`,
      new: ``,
    },
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-widen.ts',
      content: `export function probeWiden(value: unknown): any {
  return value;
}
`,
    },
  ],
} satisfies Probe;
