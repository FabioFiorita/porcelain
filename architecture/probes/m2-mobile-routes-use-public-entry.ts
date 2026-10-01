import type { Probe } from '../probe.ts';

export default {
  decision: 'M2',
  plants: 'mobile routes use public entry',
  gate: 'arch',
  rule: 'mobile-routes-import-feature-index:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/mobile/src/app/files.tsx',
      old: "export { FilesScreen as default } from '../features/files';",
      new: "export { FilesScreen as default } from '../features/files/views/files-screen';",
    },
  ],
} satisfies Probe;
