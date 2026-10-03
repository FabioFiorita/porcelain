import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile routes use public entry',
  gate: 'arch',
  rule: 'mobile-routes-import-feature-index:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/mobile/src/app/(files)/files.tsx',
      old: "import { FilesScreen } from '../../features/files';",
      new: "import { FilesScreen } from '../../features/files/views/files-screen';",
    },
  ],
} satisfies Probe;
