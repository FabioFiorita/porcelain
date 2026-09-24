import type { Probe } from '../probe.ts';

export default {
  decision: 'S4',
  plants:
    'access/rules/credential.ts: parseCredential throws InvalidPairingError on a malformed value',
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
      kind: 'replace',
      path: 'packages/access/src/rules/credential.ts',
      old: `  return parts?.id && parts.secret
    ? { id: parts.id, secret: parts.secret }
    : undefined;`,
      new: `  if (!parts?.id || !parts.secret) throw new InvalidPairingError();
  return { id: parts.id, secret: parts.secret };`,
    },
  ],
} satisfies Probe;
