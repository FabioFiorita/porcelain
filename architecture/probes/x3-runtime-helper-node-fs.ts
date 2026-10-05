import type { Probe } from '../probe.ts';

export default {
  decision: 'X3',
  plants:
    'runtime/probe-read.ts wrapping node:fs/promises readFile, called by a use case',
  gate: 'arch',
  rule: 'runtime-node-allow-list:',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/src/runtime/probe-read.ts',
      content: `import { readFile } from 'node:fs/promises';

export function probeRead(path: string): Promise<string> {
  return readFile(path, 'utf8');
}
`,
    },
    {
      kind: 'create',
      path: 'apps/server/src/use-cases/projects/probe-read-file.ts',
      content: `import { probeRead } from '../../runtime/probe-read.ts';
import { Effect } from 'effect';

export class ProbeReadFileUseCase {
  execute(): Effect.Effect<string> {
    return Effect.promise(() => probeRead('/etc/hostname'));
  }
}
`,
    },
  ],
} satisfies Probe;
