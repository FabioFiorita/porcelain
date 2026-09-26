import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'a projects spec running the access device store contract by path, which only access fakes, storage and server adapters may run',
  gate: 'arch',
  rule: 'store-contract-runs-against-its-fake-storage-and-server-adapters-only:',
  edits: [
    {
      kind: 'append',
      path: 'packages/projects/src/rules/derive-project-name.spec.ts',
      content: `
import { deviceStoreContract } from '../../../access/spec/contracts/device-store-contract.ts';

deviceStoreContract('probe', () => ({ store: { find: () => undefined, list: () => [], markRevoked: () => undefined, recordSighting: () => undefined }, close: () => undefined }));
`,
    },
  ],
} satisfies Probe;
