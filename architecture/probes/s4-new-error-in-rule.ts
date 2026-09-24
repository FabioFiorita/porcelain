import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    'access/rules/credential.ts: new function credentialFailure() returning new InvalidPairingError() for the service to throw',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/access/src/rules/credential.ts',
      old: "} from '../models/credential.ts';",
      new: `} from '../models/credential.ts';
import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';`,
    },
    {
      kind: 'append',
      path: 'packages/access/src/rules/credential.ts',
      content: `
export function credentialFailure(): Error {
  return new InvalidPairingError();
}
`,
    },
  ],
} satisfies Probe;
