import type { Probe } from '../probe.ts';

export default {
  decision: 'C5',
  plants:
    'checkout-session.ts throws a projects domain error; an adapter may throw only the kernel errors every domain shares',
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
