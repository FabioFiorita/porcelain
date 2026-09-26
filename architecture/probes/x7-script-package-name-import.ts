import type { Probe } from '../probe.ts';

export default {
  decision: 'X7',
  plants:
    'scripts/probe-reach.ts importing a contract schema by its package name',
  gate: 'lint',
  rule: 'porcelain(root-scripts-import-no-package)',
  edits: [
    {
      kind: 'create',
      path: 'scripts/probe-reach.ts',
      content: `import { redeemPairingResponseSchema } from '@porcelain/contracts/access';

process.stdout.write(\`\${JSON.stringify(redeemPairingResponseSchema.parse({}))}\\n\`);
`,
    },
  ],
} satisfies Probe;
