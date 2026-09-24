import type { Probe } from '../probe.ts';

export default {
  decision: 'X2',
  plants: 'a rule formatting a day with Intl.DateTimeFormat',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'create',
      path: 'packages/projects/src/rules/probe-day.ts',
      content: `export function probeDay(instant: string): string {
  return Intl.DateTimeFormat('en').format(new Date(instant));
}
`,
    },
  ],
} satisfies Probe;
