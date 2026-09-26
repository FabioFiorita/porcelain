import type { Probe } from '../probe.ts';

export default {
  decision: 'P4',
  plants:
    'an empty catch fixed without lowering the baseline, so it could come back unnoticed',
  gate: 'web-lint',
  rule: 'style(web-baseline)',
  edits: [
    {
      kind: 'replace',
      path: 'apps/web/src/features/review/views/inline-composer.tsx',
      old: '    } catch {}\n',
      new: '    } catch {\n      onClose();\n    }\n',
    },
  ],
} satisfies Probe;
