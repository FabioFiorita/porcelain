import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    'access/rules/pairing-grant.ts: pairingGrantExpired() compares Date.parse(expiresAt) with Date.now()',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'append',
      path: 'packages/access/src/rules/pairing-grant.ts',
      content: `
export function pairingGrantExpired(grant: StoredPairingGrant): boolean {
  return Date.parse(grant.expiresAt) < Date.now();
}
`,
    },
  ],
} satisfies Probe;
