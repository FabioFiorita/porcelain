import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'new packages/git/src/shared/strings.ts: a flat helper file in git shared/, which holds the template folders only',
  gate: 'arch',
  rule: 'infrastructure-layout:',
  edits: [
    {
      kind: 'create',
      path: 'packages/git/src/shared/strings.ts',
      content: `export function withoutNewline(text: string): string {
  return text.trimEnd();
}
`,
    },
  ],
} satisfies Probe;
