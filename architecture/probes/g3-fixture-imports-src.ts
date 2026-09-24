import type { Probe } from '../probe.ts';

export default {
  decision: 'G3',
  plants:
    'git/spec/fixtures/fixture.ts imports isMissing from ../../src/shared/errno.ts',
  gate: 'lint',
  rule: 'porcelain(fixture-imports)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git/spec/fixtures/fixture.ts',
      old: "import { readFileSync } from 'node:fs';",
      new: `import { readFileSync } from 'node:fs';
import { isMissing } from '../../src/shared/errno.ts';

export function fixtureMissing(error: unknown): boolean {
  return isMissing(error);
}`,
    },
  ],
} satisfies Probe;
