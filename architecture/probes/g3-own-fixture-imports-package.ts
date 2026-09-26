import type { Probe } from '../probe.ts';

export default {
  decision: 'G3',
  plants: 'git/spec/fixtures/fixture.ts imports a type from @porcelain/process',
  gate: 'lint',
  rule: 'porcelain(fixture-imports)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git/spec/fixtures/fixture.ts',
      old: "import { readFileSync } from 'node:fs';",
      new: `import type { CommandOutput } from '@porcelain/process';
import { readFileSync } from 'node:fs';

export type CapturedOutput = CommandOutput;`,
    },
  ],
} satisfies Probe;
