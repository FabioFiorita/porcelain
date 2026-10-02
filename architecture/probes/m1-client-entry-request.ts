import type { Probe } from '../probe.ts';

export default {
  decision: 'M1',
  plants: 'the hooks entry exposes a request API to views',
  gate: 'arch',
  rule: 'client-feature-api-cannot-import-client-request-api:',
  edits: [
    {
      kind: 'append',
      path: 'packages/client/src/features/access/index.ts',
      content: "export { createRemoteApi } from './api.ts';\n",
    },
  ],
} satisfies Probe;
