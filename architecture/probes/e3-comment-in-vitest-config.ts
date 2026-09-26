import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants: 'vitest.config.ts: a // comment above defineConfig',
  gate: 'lint',
  rule: 'porcelain(no-comments)',
  edits: [
    {
      kind: 'replace',
      path: 'vitest.config.ts',
      old: 'export default defineConfig({',
      new: `// one project per package
export default defineConfig({`,
    },
  ],
} satisfies Probe;
