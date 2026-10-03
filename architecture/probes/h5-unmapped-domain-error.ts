import type { Probe } from '../probe.ts';

export default {
  decision: 'H5',
  plants:
    'the HTTP status table imports InvalidPairingAddressError but omits its mapping, silently turning a domain failure into a 500',
  gate: 'arch',
  rule: 'status-policy-complete:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/http/status-policy.ts',
      old: '      InvalidPairingAddressError,\n',
      new: '',
    },
  ],
} satisfies Probe;
