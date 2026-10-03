import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    'access/rules/credential.ts: newCredentialId() returns the global crypto.randomUUID()',
  gate: 'typecheck',
  rule: 'error TS2304',
  edits: [
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function newCredentialId(): string {
  return crypto.randomUUID();
}
`,
    },
  ],
} satisfies Probe;
