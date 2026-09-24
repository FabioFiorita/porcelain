import type { Probe } from '../probe.ts';

export default {
  decision: 'K1',
  plants:
    'new packages/agents/src/commit-planning/helpers/trim-answer.ts: a helpers folder in agents, which the helpers rule now covers',
  gate: 'arch',
  rule: 'no-helpers-folder',
  edits: [
    {
      kind: 'create',
      path: 'packages/agents/src/commit-planning/helpers/trim-answer.ts',
      content: `export function trimAnswer(answer: string): string {
  return answer.trim();
}
`,
    },
  ],
} satisfies Probe;
