import type { Probe } from '../probe.ts';

export default {
  decision: 'WG4',
  plants:
    'the only mobile feature map file for the History screen names the Files screen instead, so no map names the History screen',
  gate: 'features',
  rule: 'apps/mobile/src/app/(history)/history.tsx: it renders the page at /history, which no mobile map file names as its screen',
  edits: [
    {
      kind: 'replace',
      path: '.agents/skills/mobile-verify/features/history.history.md',
      old: 'screen: /history\n',
      new: 'screen: /files\n',
    },
  ],
} satisfies Probe;
