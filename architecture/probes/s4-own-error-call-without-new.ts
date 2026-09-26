import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    "access/rules/credential.ts: credentialFailure() returns Error('Malformed credential') (Error called without new)",
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function credentialFailure(): Error {
  return Error('Malformed credential');
}
`,
    },
  ],
} satisfies Probe;
