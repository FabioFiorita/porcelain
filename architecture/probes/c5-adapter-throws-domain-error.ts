import type { Probe } from '../probe.ts';

export default {
  decision: 'C5',
  plants:
    'checkout-session.ts throws a projects domain error; adapters expose kernel and foreign Git failures, while domain decisions belong to services',
  gate: 'arch',
  rule: 'gateway-cannot-import-error-api:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/projects/checkout-session.ts',
      content: `import { ProjectNotFoundError } from '@porcelain/projects/errors';
export const probeError = ProjectNotFoundError;
`,
    },
  ],
} satisfies Probe;
