import type { Probe } from '../probe.ts';

export default {
  decision: 'G3',
  plants:
    'git/spec/fixtures/fixture.ts imports zod and validates the fixture name',
  gate: 'lint',
  rule: 'porcelain(fixture-imports)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/git/spec/fixtures/fixture.ts',
      old: "import { readFileSync } from 'node:fs';",
      new: `import { readFileSync } from 'node:fs';
import { z } from 'zod';`,
    },
    {
      kind: 'replace',
      path: 'packages/git/spec/fixtures/fixture.ts',
      old: '  return readFileSync(new URL(name, import.meta.url));',
      new: '  return readFileSync(new URL(z.string().parse(name), import.meta.url));',
    },
  ],
} satisfies Probe;
