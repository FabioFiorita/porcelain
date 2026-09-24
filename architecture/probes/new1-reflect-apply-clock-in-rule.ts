import type { Probe } from '../probe.ts';

export default {
  decision: 'R4',
  plants:
    'access/rules/credential.ts: issuedNow() reads the clock through Reflect.apply(Date.now, undefined, [])',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function issuedNow(): number {
  return Reflect.apply(Date.now, undefined, []);
}
`,
    },
  ],
} satisfies Probe;
