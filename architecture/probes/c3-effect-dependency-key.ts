import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants:
    'a secret source replaces the required id source despite having the same method shape',
  gate: 'typecheck',
  rule: 'error TS377004',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/services/issue-pairing-service.spec.ts',
      old: 'Effect.provideService(IdSource, new SequentialIdSource()),',
      new: 'Effect.provideService(SecretSource, new SequentialIdSource()),',
    },
  ],
} satisfies Probe;
