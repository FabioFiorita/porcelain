import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'a server files adapter imports a git parser by path instead of a capability entry',
  gate: 'arch',
  rule: 'git-public-api-only:',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/adapters/files/inspect-path.ts',
      content:
        "import '../../../../../packages/git/src/shared/parsers/oid.ts';\n",
    },
  ],
} satisfies Probe;
