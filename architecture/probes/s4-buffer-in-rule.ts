import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    "access/rules/credential.ts: credential() encodes the token with Buffer.from(...).toString('base64url')",
  gate: 'lint',
  rule: 'porcelain(no-node-globals)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/rules/credential.ts',
      old: '  return { id, secret, token: `${kind}_${id}_${secret}` };',
      new: `  const encoded = Buffer.from(secret).toString('base64url');
  return { id, secret, token: \`\${kind}_\${id}_\${encoded}\` };`,
    },
  ],
} satisfies Probe;
