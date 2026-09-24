import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'files/services/list-directory-service.ts: Buffer.byteLength(JSON.stringify(listing)) instead of the kernel utf8ByteLength rule',
  gate: 'lint',
  rule: 'porcelain(no-node-globals)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: '    if (utf8ByteLength(JSON.stringify(listing)) > this.options.maxResponseBytes)',
      new: '    if (Buffer.byteLength(JSON.stringify(listing)) > this.options.maxResponseBytes)',
    },
    {
      kind: 'replace',
      path: 'packages/files/src/services/list-directory-service.ts',
      old: "import { utf8ByteLength, withoutGitDirectory } from '@porcelain/kernel/rules';",
      new: "import { withoutGitDirectory } from '@porcelain/kernel/rules';",
    },
  ],
} satisfies Probe;
