import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    'access/rules/credential.ts: mintSecret() using randomBytes imported from node:crypto',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'prepend',
      path: 'packages/access/src/rules/credential.ts',
      content: `import { randomBytes } from 'node:crypto';
`,
    },
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function mintSecret(): string {
  return randomBytes(32).toString('base64url');
}
`,
    },
  ],
} satisfies Probe;
