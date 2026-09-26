import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    'access/rules/credential.ts: mintSecret() uses the global crypto.getRandomValues (no import)',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function mintSecret(): string {
  return crypto.getRandomValues(new Uint8Array(32)).toHex();
}
`,
    },
  ],
} satisfies Probe;
