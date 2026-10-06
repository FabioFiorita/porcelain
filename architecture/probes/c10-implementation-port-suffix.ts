import type { Probe } from '../probe.ts';

export default {
  decision: 'STYLE',
  plants: 'an implementation name no longer ends in the port it implements',
  gate: 'lint',
  rule: 'porcelain(implementation-name)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/runtime/random-id-source.ts',
      old: 'export class RandomIdSource',
      new: 'export class RandomIdSourceAdapter',
    },
  ],
} satisfies Probe;
