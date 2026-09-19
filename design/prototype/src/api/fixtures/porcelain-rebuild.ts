import { WORKTREE_IDS } from './ids';
import { FAVICON_SVG, LOGO_AFTER, LOGO_BEFORE } from './images';
import { REBUILD_NEW_FILES, REBUILD_REVIEW } from './review-rebuild';
import { SOURCES } from './sources-changed';
import { FILE_CONTENTS } from './sources-unchanged';
import { type FileSeed, unchanged, type WorktreeSeed } from './types';

const source = (path: string) => {
  const pair = SOURCES.find((entry) => entry.path === path);
  if (pair == null) throw new Error(`Missing fixture source ${path}`);
  return pair;
};

const REVIEWED_STATE_DECISION = `# Reviewed state

Status: accepted

## Context

\`file_preferences\` stored a reviewed flag per project. Two worktrees of the
same project shared one flag, and nothing cleared it when the file changed.

## Decision

- Reviewed marks are scoped to a **worktree**.
- A mark stores the fingerprint of the diff the reviewer saw.
- The server reports a mark as \`stale\` when the fingerprint no longer matches.

## Consequences

The tick can be trusted: if it is there, you saw what is there now.
`;

const REVIEW_FLOW_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<style>
  body { font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 24px; }
  .row { display: flex; gap: 12px; align-items: center; }
  .box { border: 1px solid #8884; border-radius: 10px; padding: 10px 14px; }
  .arrow { opacity: .5; }
  button { margin-top: 16px; font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid #8886; background: transparent; cursor: pointer; }
</style>
</head>
<body>
  <h1>Review flow</h1>
  <div class="row">
    <div class="box">Agent finishes</div><span class="arrow">→</span>
    <div class="box">Handoff</div><span class="arrow">→</span>
    <div class="box">Review + comments</div><span class="arrow">→</span>
    <div class="box">Agent answers</div>
  </div>
  <button type="button" onclick="this.textContent = 'Scripts run inside the sandbox ✓'">Run a script</button>
</body>
</html>
`;

const LAYERS_ROUTE_BEFORE = `import type { FastifyInstance } from 'fastify';

export async function registerLayerRoutes(app: FastifyInstance) {
  app.get('/worktrees/:worktreeId/layers', async (request) => {
    const { worktreeId } = request.params as { worktreeId: string };
    const set = await app.db.layerSets.find(worktreeId);
    if (set == null) throw new Error('No layers for this worktree');
    return set;
  });
}
`;

const files: Record<string, FileSeed> = {
  ...unchanged(FILE_CONTENTS),
  'design/review-flow.html': {
    head: REVIEW_FLOW_HTML,
    working: REVIEW_FLOW_HTML,
  },
  // Staged by the agent with `git add`, so the list of changes reports it as staged.
  'docs/decisions/reviewed-state.md': {
    head: null,
    working: REVIEWED_STATE_DECISION,
    staged: true,
  },
  // The server refuses to read these as text; the content only matters to the tree.
  // A changed image: reviews list it as a non-text change, and Files previews it.
  'apps/web/public/logo.png': {
    head: LOGO_BEFORE,
    working: LOGO_AFTER,
    binary: { mime: 'image/png' },
  },
  'apps/web/public/favicon.svg': { head: FAVICON_SVG, working: FAVICON_SVG },
  'fixtures/playground-export.json': {
    head: '[]',
    working: '[]',
    unreadable: 'too-large',
  },
  // Build output. Ignored by .gitignore, so git reports no change for it.
  ...unchanged({
    'dist/index.html': '<!doctype html>\n<div id="root"></div>\n',
  }),
};
for (const pair of SOURCES)
  files[pair.path] = { head: pair.old, working: pair.next };
for (const [path, text] of Object.entries(REBUILD_NEW_FILES))
  files[path] = { head: null, working: text };

export const PORCELAIN_REBUILD: WorktreeSeed = {
  files,
  ignored: ['.env', 'dist/'],
  symlinks: [{ path: 'docs/current', target: 'docs/decisions/' }],
  submodules: ['vendor/highlight'],
  branch: { upstream: 'origin/codex/porcelain-rebuild', ahead: 1, behind: 0 },
  otherBranches: [
    'main',
    'codex/review-layer-empty-match',
    'spike/pierre-trees',
  ],
  review: REBUILD_REVIEW,
  // Agent-opened notes from building the review, one answered in the thread, and a reviewer's question.
  threads: [
    {
      id: 'd1000000-0000-4000-8000-000000000001',
      anchor: {
        kind: 'codeRange',
        filePath: 'apps/server/src/db/schema/reviewed-files.ts',
        startLine: 13,
        endLine: 16,
        side: 'additions',
      },
      resolved: false,
      messages: [
        {
          author: 'agent',
          body: 'Look closely: the fingerprint is stored on the row, not recomputed on read. This is what makes a tick clear itself when the file changes, and it is the one decision here that is hard to undo later.',
          minutesAgo: 34,
        },
        {
          author: 'reviewer',
          body: 'Why store it instead of comparing against the file on read?',
          minutesAgo: 30,
        },
        {
          author: 'agent',
          body: 'So the index can say "stale" without reading every file. The row already holds what you saw; the server only fingerprints the current diff once per status refresh.',
          minutesAgo: 28,
        },
      ],
    },
    {
      id: 'd1000000-0000-4000-8000-000000000002',
      anchor: {
        kind: 'codeRange',
        filePath: 'packages/contracts/src/comments.ts',
        startLine: 18,
        endLine: 18,
        side: 'additions',
      },
      resolved: false,
      messages: [
        {
          author: 'agent',
          body: 'Look closely: `author` is required, with no default. Threads stored before this change have no author, so they need a backfill (as reviewer) before this schema parses them.',
          minutesAgo: 34,
        },
      ],
    },
    {
      id: 'd1000000-0000-4000-8000-000000000005',
      anchor: {
        kind: 'codeRange',
        filePath: 'packages/contracts/src/review-layers.ts',
        startLine: 21,
        endLine: 21,
        side: 'additions',
      },
      resolved: false,
      messages: [
        {
          author: 'agent',
          body: 'Look closely: a layer set now carries the fingerprint of the diff it was built from. When the diff moves on, the client can tell the layers are out of date instead of silently mis-grouping files.',
          minutesAgo: 33,
        },
      ],
      // The agent rewrote these lines after commenting, so the thread is outdated.
      snapshot: '  layerFingerprint: z.string().length(16),',
    },
    {
      id: 'd1000000-0000-4000-8000-000000000006',
      anchor: { kind: 'worktree' },
      resolved: false,
      messages: [
        {
          author: 'reviewer',
          body: 'Before you commit, add a line to `CHANGELOG.md` about ticks being **per worktree** now.',
          minutesAgo: 12,
        },
      ],
    },
    {
      id: 'd1000000-0000-4000-8000-000000000003',
      anchor: {
        kind: 'file',
        filePath: 'apps/web/src/views/review/review-surface.tsx',
      },
      resolved: false,
      messages: [
        {
          author: 'reviewer',
          body: 'Is this component meant to own the threads, or only render them?',
          minutesAgo: 50,
        },
        {
          author: 'agent',
          body: 'Only render them. Threads come from the query one level up; this surface receives them and reports anchors back.',
          minutesAgo: 47,
        },
      ],
    },
    {
      id: 'd1000000-0000-4000-8000-000000000004',
      anchor: {
        kind: 'codeRange',
        filePath: 'packages/contracts/src/review-layers.ts',
        startLine: 7,
        endLine: 10,
        side: 'additions',
      },
      resolved: true,
      messages: [
        {
          author: 'reviewer',
          body: 'Should `note` be required?',
          minutesAgo: 90,
        },
        {
          author: 'agent',
          body: 'No: most files speak for themselves, and a required note would get filled with noise.',
          minutesAgo: 88,
        },
      ],
    },
  ],
  commits: [
    {
      oid: 'e742deec3a1f5b9d2c4e6f8a0b1c3d5e7f9a1b2c',
      parentOids: ['a91c004d7e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b'],
      subject: 'Move reviewed state to the worktree',
      body: 'The old table was project-scoped, so a tick leaked across worktrees.',
      author: 'Fabio Fiorita',
      minutesAgo: 6,
      refs: ['HEAD', 'codex/porcelain-rebuild'],
      files: [
        {
          path: 'apps/server/src/db/schema/reviewed-files.ts',
          before: source('apps/server/src/db/schema/reviewed-files.ts').old,
          after: source('apps/server/src/db/schema/reviewed-files.ts').next,
        },
      ],
    },
    {
      oid: 'a91c004d7e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b',
      parentOids: [
        '6dc45a84b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1',
        'f30ba17c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a',
      ],
      subject: "Merge branch 'codex/review-layer-empty-match'",
      author: 'Fabio Fiorita',
      minutesAgo: 60,
      files: [
        {
          path: 'apps/server/src/http/routes/layers.ts',
          before: LAYERS_ROUTE_BEFORE,
          after: FILE_CONTENTS['apps/server/src/http/routes/layers.ts'] ?? '',
        },
      ],
      // Against the merged branch, the merge brings in what the main line had gained (6dc45a8).
      filesByParent: {
        2: [
          {
            path: 'packages/contracts/src/review-layers.ts',
            before: source('packages/contracts/src/review-layers.ts').old,
            after: source('packages/contracts/src/review-layers.ts').next,
          },
          {
            path: 'packages/contracts/src/comments.ts',
            before: source('packages/contracts/src/comments.ts').old,
            after: source('packages/contracts/src/comments.ts').next,
          },
        ],
      },
    },
    {
      oid: '6dc45a84b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1',
      parentOids: ['bc98763e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c'],
      subject: 'Give layers a markdown summary and per-file notes',
      author: 'Fabio Fiorita',
      minutesAgo: 180,
      files: [
        {
          path: 'packages/contracts/src/review-layers.ts',
          before: source('packages/contracts/src/review-layers.ts').old,
          after: source('packages/contracts/src/review-layers.ts').next,
        },
        {
          path: 'packages/contracts/src/comments.ts',
          before: source('packages/contracts/src/comments.ts').old,
          after: source('packages/contracts/src/comments.ts').next,
        },
      ],
    },
    {
      oid: 'f30ba17c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a',
      parentOids: ['7ad3e91f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d'],
      subject: 'Return an empty layer set instead of throwing on no match',
      author: 'Fabio Fiorita',
      minutesAgo: 240,
      refs: ['origin/codex/review-layer-empty-match'],
      files: [
        {
          path: 'apps/server/src/http/routes/layers.ts',
          before: LAYERS_ROUTE_BEFORE,
          after: FILE_CONTENTS['apps/server/src/http/routes/layers.ts'] ?? '',
        },
      ],
    },
    {
      oid: '7ad3e91f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d',
      parentOids: ['bc98763e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c'],
      subject: 'Cover the empty-match case in the layer route tests',
      author: 'Fabio Fiorita',
      minutesAgo: 300,
      files: [
        {
          path: 'apps/server/src/http/routes/layers.test.ts',
          before: null,
          after: `import { expect, it } from 'vitest';
import { buildApp } from '../../app';

it('returns an empty layer set when nothing was handed off', async () => {
  const app = await buildApp();
  const response = await app.inject({ url: '/worktrees/unknown/layers' });
  expect(response.json()).toEqual({ worktreeId: 'unknown', layers: [] });
});
`,
        },
      ],
    },
    {
      oid: 'bc98763e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c',
      parentOids: ['de7a489d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b'],
      subject: 'Update TanStack Highlight to 0.0.11',
      author: 'Fabio Fiorita',
      minutesAgo: 1440,
      files: [
        {
          path: 'apps/web/package.json',
          before:
            '{\n  "dependencies": {\n    "@tanstack/highlight": "0.0.10"\n  }\n}\n',
          after:
            '{\n  "dependencies": {\n    "@tanstack/highlight": "0.0.11"\n  }\n}\n',
        },
      ],
    },
    {
      oid: 'de7a489d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b',
      parentOids: ['59fc9add1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e'],
      subject: 'Add the React Doctor skill',
      author: 'Fabio Fiorita',
      minutesAgo: 2880,
      refs: ['main', 'origin/main'],
      files: [
        {
          path: '.agents/skills/react-doctor/SKILL.md',
          before: null,
          after:
            '---\nname: react-doctor\n---\n\n# React Doctor\n\nRun it when a React change feels slow or flaky.\n',
        },
      ],
    },
    {
      oid: '59fc9add1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e',
      parentOids: ['43845809f3bccb7e6c86025fabf0a4e1040b3891'],
      subject: 'Simplify development around the real server and web',
      author: 'Fabio Fiorita',
      minutesAgo: 4320,
      files: [
        {
          path: 'package.json',
          before:
            '{\n  "scripts": {\n    "dev": "concurrently \\"pnpm dev:server\\" \\"pnpm dev:web\\" \\"pnpm dev:mock\\""\n  }\n}\n',
          after:
            '{\n  "scripts": {\n    "dev:web": "pnpm --filter @porcelain/web dev"\n  }\n}\n',
        },
      ],
    },
    // Older, linear history: enough pages that the History list has to scroll to reach the start.
    {
      oid: '43845809f3bccb7e6c86025fabf0a4e1040b3891',
      parentOids: ['1340a4e468a4b21860cfba1f3a19f3732a152770'],
      subject: "Wire the web client to the real server's review routes",
      author: 'Fabio Fiorita',
      minutesAgo: 5760,
      files: [
        {
          path: 'apps/web/src/api/review/live.ts',
          before: null,
          after: 'export const liveReview = createReviewClient(fetch);\n',
        },
      ],
    },
    {
      oid: '1340a4e468a4b21860cfba1f3a19f3732a152770',
      parentOids: ['7cc98d407b155212e7313434498643c13a941c22'],
      subject: 'Stop polling status while the tab is hidden',
      author: 'Ana Souza',
      minutesAgo: 7200,
      files: [
        {
          path: 'apps/web/src/query/status.ts',
          before: null,
          after: 'export const STATUS_POLL_MS = 4000;\n',
        },
      ],
    },
    {
      oid: '7cc98d407b155212e7313434498643c13a941c22',
      parentOids: ['42b22e429021665d128e32c565e126c08261a76a'],
      subject: 'Add a boundary rule for views importing api',
      author: 'Fabio Fiorita',
      minutesAgo: 8640,
      files: [
        {
          path: 'scripts/boundary-rules.ts',
          before: null,
          after: "export const rules = [{ from: 'views', deny: ['api'] }];\n",
        },
      ],
    },
    {
      oid: '42b22e429021665d128e32c565e126c08261a76a',
      parentOids: ['90d76a62f7de650e7ce6a9b4074ef43af6af5d98'],
      subject: 'Return 422 for text reads the server cannot decode',
      author: 'Fabio Fiorita',
      minutesAgo: 10080,
      files: [
        {
          path: 'apps/server/src/http/file-error-response.ts',
          before: null,
          after:
            "export const UNSUPPORTED_TEXT = 'File is not supported UTF-8 text';\n",
        },
      ],
    },
    {
      oid: '90d76a62f7de650e7ce6a9b4074ef43af6af5d98',
      parentOids: ['7f99bc6f02bd1b746258ae0313a5dd39b7be862d'],
      subject: 'Document how prepare and execute pair up',
      author: 'Marcus Lee',
      minutesAgo: 11520,
      files: [
        {
          path: 'docs/git-actions.md',
          before: null,
          after:
            '# Git actions\n\nPrepare first, then execute with a fresh request id.\n',
        },
      ],
    },
    {
      oid: '7f99bc6f02bd1b746258ae0313a5dd39b7be862d',
      parentOids: ['3157f11731bcfb1c39ed2a7edba0512a4b848425'],
      subject: 'Keep receipts for an hour after execute',
      author: 'Fabio Fiorita',
      minutesAgo: 12960,
      files: [
        {
          path: 'apps/server/src/git/receipts.ts',
          before: null,
          after: 'export const RECEIPT_TTL_MS = 60 * 60 * 1000;\n',
        },
      ],
    },
    {
      oid: '3157f11731bcfb1c39ed2a7edba0512a4b848425',
      parentOids: ['84bbf49b84427f2acc51f75f2c3ba505e803e27d'],
      subject: 'Run commit-index with the message on stdin',
      author: 'Fabio Fiorita',
      minutesAgo: 14400,
      files: [
        {
          path: 'packages/git/src/commands/commit-index.ts',
          before: null,
          after: "export const commitIndexArgs = ['commit', '--file=-'];\n",
        },
      ],
    },
    {
      oid: '84bbf49b84427f2acc51f75f2c3ba505e803e27d',
      parentOids: ['14904ac6b62ac9cafe17e41bbc86ec31dcdf2edd'],
      subject: 'List worktrees with git worktree list --porcelain',
      author: 'Fabio Fiorita',
      minutesAgo: 17280,
      files: [
        {
          path: 'packages/git/src/commands/list-worktrees.ts',
          before: null,
          after:
            "export const listWorktreesArgs = ['worktree', 'list', '--porcelain'];\n",
        },
      ],
    },
    {
      oid: '14904ac6b62ac9cafe17e41bbc86ec31dcdf2edd',
      parentOids: ['8f03ebc038fa4a1ac7128f6a67dc84bdedcab547'],
      subject: 'Add the inventory contract',
      author: 'Ana Souza',
      minutesAgo: 20160,
      files: [
        {
          path: 'packages/contracts/src/inventory.ts',
          before: null,
          after: 'export type InventoryResponse = { environmentId: string };\n',
        },
      ],
    },
    {
      oid: '8f03ebc038fa4a1ac7128f6a67dc84bdedcab547',
      parentOids: ['64d2baa473c0371b56bbddc7b94a38fbaac0f94c'],
      subject: 'Serve the web build from the server in production',
      author: 'Marcus Lee',
      minutesAgo: 23040,
      files: [
        {
          path: 'apps/server/src/http/static.ts',
          before: null,
          after: "export const STATIC_ROOT = 'apps/web/dist';\n",
        },
      ],
    },
    {
      oid: '64d2baa473c0371b56bbddc7b94a38fbaac0f94c',
      parentOids: ['4a35387be739933f7c9e6486959ec1affb2c1648'],
      subject: 'Set up the pnpm workspace',
      author: 'Fabio Fiorita',
      minutesAgo: 25920,
      files: [
        {
          path: 'pnpm-workspace.yaml',
          before: null,
          after: 'packages:\n  - apps/*\n  - packages/*\n',
        },
      ],
    },
    {
      oid: '4a35387be739933f7c9e6486959ec1affb2c1648',
      parentOids: [],
      subject: 'Initial commit',
      author: 'Fabio Fiorita',
      minutesAgo: 28800,
      files: [
        {
          path: 'README.md',
          before: null,
          after: '# Porcelain\n\nReview what your agents hand off.\n',
        },
      ],
    },
  ],
};

export const PORCELAIN_REBUILD_ID = WORKTREE_IDS.porcelainRebuild;
