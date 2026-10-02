import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'a native view makes a request outside its transport owner',
  gate: 'lint',
  rule: 'porcelain(web-transport-owner)',
  edits: [
    {
      kind: 'append',
      path: 'apps/mobile/src/features/access/views/settings-screen.tsx',
      content:
        '\nexport const readEnvironment = () => fetch("http://localhost/api/environment");\n',
    },
  ],
} satisfies Probe;
