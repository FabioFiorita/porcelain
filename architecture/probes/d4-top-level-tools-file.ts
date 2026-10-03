import type { Probe } from '../probe.ts';

export default {
  decision: 'P29',
  plants:
    'a top-level tools/serve-banner.ts with a disable directive and any, imported by scripts/serve.ts',
  gate: 'lint',
  rule: 'style(code-outside-lint-roots)',
  edits: [
    {
      kind: 'create',
      path: 'tools/serve-banner.ts',
      content: `${'//'} eslint-disable-next-line\nexport const banner: any = 'porcelain';\n`,
    },
    {
      kind: 'prepend',
      path: 'scripts/serve.ts',
      content: "import '../tools/serve-banner.ts';\n",
    },
  ],
} satisfies Probe;
