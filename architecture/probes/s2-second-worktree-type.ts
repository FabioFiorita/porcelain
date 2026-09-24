import type { Probe } from '../probe.ts';

export default {
  decision: 'S2',
  plants:
    'new packages/changes/src/models/worktree.ts: export type Worktree = { id; projectId; path } re-exported from changes/models/index.ts',
  gate: 'arch',
  rule: 'models-file-shape',
  edits: [
    {
      kind: 'create',
      path: 'packages/changes/src/models/worktree.ts',
      content: `export type Worktree = { id: string; projectId: string; path: string };
`,
    },
    {
      kind: 'append',
      path: 'packages/changes/src/models/index.ts',
      content: `export type { Worktree } from './worktree.ts';
`,
    },
  ],
} satisfies Probe;
