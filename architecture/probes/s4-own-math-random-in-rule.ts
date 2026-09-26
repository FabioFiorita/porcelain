import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants: 'access/rules/credential.ts: jitter() uses Math.random()',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function retryJitterMs(baseMs: number): number {
  return Math.floor(baseMs * Math.random());
}
`,
    },
  ],
} satisfies Probe;
