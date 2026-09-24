import type { Probe } from '../probe.ts';

export default {
  decision: 'EVASION',
  plants:
    'new apps/server/lib/clock-override.ts (outside every lint/arch root: comment, Date, null) imported by adapters/runtime/system-clock.ts',
  gate: 'arch',
  rule: 'code-outside-roots',
  edits: [
    {
      kind: 'create',
      path: 'apps/server/lib/clock-override.ts',
      content: `// frozen clock for demos
export function overriddenNow(): string | null {
  return process.env.PORCELAIN_NOW == null ? null : new Date(Date.now()).toISOString();
}
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/runtime/system-clock.ts',
      old: "import type { Clock } from '@porcelain/kernel/ports';",
      new: `import type { Clock } from '@porcelain/kernel/ports';
import { overriddenNow } from '../../../lib/clock-override.ts';`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/adapters/runtime/system-clock.ts',
      old: '() => new Date().toISOString()',
      new: '() => overriddenNow() ?? new Date().toISOString()',
    },
  ],
} satisfies Probe;
