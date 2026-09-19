import { FILE_CONTENTS } from './sources-unchanged';
import { check, layerLink, SUMMARY_STYLE } from './summary-style';
import type { ReviewSeed } from './types';
import { type CommitSeed, unchanged, type WorktreeSeed } from './types';

const BOARD_BEFORE = `import { listTasks } from './task-store.mjs';

export function renderBoard(root) {
  const columns = groupByStatus(listTasks());
  root.replaceChildren(...columns.map(renderColumn));
}

function groupByStatus(tasks) {
  const columns = { todo: [], doing: [], done: [] };
  for (const task of tasks) columns[task.status].push(task);
  return Object.entries(columns);
}
`;

const BOARD_AFTER = `import { listTasks } from './task-store.mjs';
import { matchesFilter, readFilter } from './board-filter.mjs';

export function renderBoard(root) {
  const filter = readFilter(location.search);
  const tasks = listTasks().filter((task) => matchesFilter(task, filter));
  const columns = groupByStatus(tasks);
  root.replaceChildren(...columns.map(renderColumn));
}

function groupByStatus(tasks) {
  const columns = { todo: [], doing: [], done: [] };
  for (const task of tasks) columns[task.status].push(task);
  return Object.entries(columns);
}
`;

const BOARD_FILTER = `/**
 * The board's filter lives in the URL, so a filtered board can be shared
 * and survives a reload. An empty filter shows every task.
 */
export function readFilter(search) {
  const params = new URLSearchParams(search);
  return { tag: params.get('tag'), owner: params.get('owner') };
}

export function matchesFilter(task, filter) {
  if (filter.tag != null && !task.tags.includes(filter.tag)) return false;
  if (filter.owner != null && task.owner !== filter.owner) return false;
  return true;
}
`;

const BOARD_FILTER_TEST = `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesFilter } from '../src/board-filter.mjs';

test('an empty filter keeps every task', () => {
  assert.equal(matchesFilter({ tags: [], owner: 'ana' }, { tag: null, owner: null }), true);
});

test('a tag filter drops tasks without the tag', () => {
  assert.equal(matchesFilter({ tags: ['api'], owner: 'ana' }, { tag: 'web', owner: null }), false);
});
`;

const TASK_STORE = `const tasks = [
  { id: 1, title: 'Sketch the board', status: 'done', tags: ['design'], owner: 'ana' },
  { id: 2, title: 'Task endpoint', status: 'doing', tags: ['api'], owner: 'rui' },
  { id: 3, title: 'Responsive columns', status: 'todo', tags: ['web'], owner: 'ana' },
];

export function listTasks() {
  return tasks.map((task) => ({ ...task }));
}
`;

const cleanCommits = (prefix: string, branch: string): CommitSeed[] => [
  {
    oid: `${prefix}1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a`,
    parentOids: [`${prefix}2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b`],
    subject: 'Tidy the README',
    author: 'Fabio Fiorita',
    minutesAgo: 2000,
    refs: ['HEAD', branch, `origin/${branch}`],
    files: [
      {
        path: 'README.md',
        before: '# Project\n',
        after: '# Project\n\nStart with `pnpm dev`.\n',
      },
    ],
  },
  {
    oid: `${prefix}2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b`,
    parentOids: [],
    subject: 'Initial commit',
    author: 'Fabio Fiorita',
    minutesAgo: 9000,
    files: [{ path: 'README.md', before: null, after: '# Project\n' }],
  },
];

export const PORCELAIN_CLEAN = (branch: string): WorktreeSeed => ({
  files: unchanged(FILE_CONTENTS),
  threads: [],
  commits: cleanCommits('aa', branch),
  branch: { upstream: `origin/${branch}`, ahead: 0, behind: 0 },
});

const LAYERS_ROUTE_BEFORE =
  FILE_CONTENTS['apps/server/src/http/routes/layers.ts'] ?? '';

const LAYERS_ROUTE_AFTER = `import type { FastifyInstance } from 'fastify';
import { fingerprintWorktree } from '../../review/fingerprint';

export async function registerLayerRoutes(app: FastifyInstance) {
  app.get('/worktrees/:worktreeId/layers', async (request) => {
    const { worktreeId } = request.params as { worktreeId: string };
    const set = await app.db.layerSets.find(worktreeId);
    if (set == null) return { worktreeId, layers: [], stale: false };

    // Layers describe one exact state of the worktree. Once the files move on,
    // an old set would group the wrong hunks, so it is reported as stale.
    const current = await fingerprintWorktree(app.git, worktreeId);
    return { ...set, stale: set.contentFingerprint !== current };
  });
}
`;

const FINGERPRINT = `import { createHash } from 'node:crypto';
import type { GitClient } from '@porcelain/git';

/** A stable hash of every changed path and its patch, in path order. */
export async function fingerprintWorktree(git: GitClient, worktreeId: string) {
  const changes = await git.status(worktreeId);
  const hash = createHash('sha256');
  for (const change of [...changes].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(change.path);
    hash.update(await git.patch(worktreeId, change.path));
  }
  return hash.digest('hex');
}
`;

const LAYERS_ROUTE_SPEC = `import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../test/app';

describe('GET /worktrees/:id/layers', () => {
  it('answers an empty set when nothing was handed off', async () => {
    const app = await buildTestApp();
    const response = await app.inject('/worktrees/w1/layers');
    expect(response.json()).toEqual({ worktreeId: 'w1', layers: [], stale: false });
  });

  it('marks the set stale once a file changes', async () => {
    const app = await buildTestApp({ layers: 'fixture', editAfterPublish: 'README.md' });
    const response = await app.inject('/worktrees/w1/layers');
    expect(response.json().stale).toBe(true);
  });
});
`;

const PRODUCT_AFTER = `# Product scope

Porcelain helps a developer understand and review code produced by agents
running in other tools. Scope is intentional; there is no requirement to
preserve the previous application's features.

## Review workspace

A persistent worktree navigator combines projects and worktrees. Selecting a
worktree establishes context for Files, Changes, History, comments and
artifacts.

Changes presents diffs in agent-authored review layers with explicit group and
file order. Unassigned changes remain visible. Layers that no longer match the
worktree are shown as stale instead of silently regrouping new hunks.
`;

/**
 * A branch with work in progress and no review: the agent (or the reviewer)
 * changed files, but nobody published a review or opened a thread, so it reads Changes.
 */
export const PORCELAIN_EMPTY_MATCH: WorktreeSeed = {
  files: {
    ...unchanged(FILE_CONTENTS),
    'apps/server/src/http/routes/layers.ts': {
      head: LAYERS_ROUTE_BEFORE,
      working: LAYERS_ROUTE_AFTER,
    },
    'apps/server/src/review/fingerprint.ts': {
      head: null,
      working: FINGERPRINT,
    },
    'apps/server/src/http/routes/layers.spec.ts': {
      head: null,
      working: LAYERS_ROUTE_SPEC,
    },
    'docs/product.md': {
      head: FILE_CONTENTS['docs/product.md'] ?? '',
      working: PRODUCT_AFTER,
    },
    '.env.example': {
      head: FILE_CONTENTS['.env.example'] ?? '',
      working: null,
    },
  },
  threads: [],
  commits: cleanCommits('dd', 'codex/review-layer-empty-match'),
  branch: {
    upstream: 'origin/codex/review-layer-empty-match',
    ahead: 0,
    behind: 0,
  },
};

const FIELDNOTES_SUMMARY = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Filter the board by tag or owner</title>
${SUMMARY_STYLE}
</head>
<body>
<main>
  <div class="eyebrow">
    <span class="pill ok">Ready for review</span>
    <span class="pill"><code>feat/board-filters</code></span>
  </div>
  <h1>Filter the board by tag or owner</h1>
  <p class="lede">The filter lives in the URL (<code>?tag=web</code>), so a filtered board can be shared and survives a reload. An empty filter shows every task.</p>
  <h2>Read in this order</h2>
  <div class="layers">
    ${layerLink(1, 'The board reads its filter from the URL', ['Board', 'Filter', 'Store'])}
  </div>
  <h2>How it was checked</h2>
  <div class="checks">
    ${check(true, '<code>node --test</code>', '2 new tests pass')}
    ${check(false, 'Filter controls on the board', 'not built: only the URL sets it')}
  </div>
</main>
</body>
</html>
`;

const FIELDNOTES_REVIEW: ReviewSeed = {
  summaryHtml: FIELDNOTES_SUMMARY,
  minutesAgo: 95,
  layers: [
    {
      id: 'c2000000-0000-4000-8000-000000000001',
      title: 'The board reads its filter from the URL',
      summary:
        'Rendering the board parses the query string and drops tasks that do not match before grouping them.',
      lanes: ['Board', 'Filter', 'Store'],
      steps: [
        {
          id: 'c2-1',
          lane: 0,
          title: 'renderBoard',
          text: 'Reads the filter from `location.search` and filters before grouping, so empty columns stay visible.',
          kind: 'changed',
          path: 'src/board.mjs',
          find: 'export function renderBoard',
          lines: 6,
          symbol: 'renderBoard',
        },
        {
          id: 'c2-2',
          lane: 1,
          title: 'readFilter and matchesFilter',
          text: 'Both conditions are optional; an empty filter keeps every task.',
          kind: 'changed',
          path: 'src/board-filter.mjs',
          find: 'export function readFilter',
          lines: 11,
        },
        {
          id: 'c2-3',
          lane: 2,
          title: 'listTasks',
          text: 'Unchanged: tasks are copied on the way out, so filtering never mutates the store.',
          kind: 'context',
          path: 'src/task-store.mjs',
          find: 'export function listTasks',
          lines: 3,
          symbol: 'listTasks',
        },
      ],
    },
  ],
};

/** An agent worktree with a small review and a reply the reviewer has not seen yet. */
export const FIELDNOTES_FILTERS: WorktreeSeed = {
  files: {
    ...unchanged({
      'README.md': '# fieldnotes\n\nA small task board: `node server.mjs`.\n',
      'src/task-store.mjs': TASK_STORE,
    }),
    'src/board.mjs': { head: BOARD_BEFORE, working: BOARD_AFTER },
    'src/board-filter.mjs': { head: null, working: BOARD_FILTER },
    'tests/board-filter.spec.mjs': { head: null, working: BOARD_FILTER_TEST },
  },
  branch: { upstream: 'origin/feat/board-filters', ahead: 0, behind: 2 },
  otherBranches: ['main'],
  review: FIELDNOTES_REVIEW,
  threads: [
    {
      id: 'd2000000-0000-4000-8000-000000000001',
      anchor: {
        kind: 'codeRange',
        filePath: 'src/board-filter.mjs',
        startLine: 11,
        endLine: 12,
        side: 'additions',
      },
      resolved: false,
      seen: false,
      messages: [
        {
          author: 'reviewer',
          body: 'Should the tag match be case-insensitive?',
          minutesAgo: 80,
        },
        {
          author: 'agent',
          body: 'Tags are stored lowercase by the task endpoint, so an exact match is enough. I added that to the store’s docs instead of lowercasing here.',
          minutesAgo: 20,
        },
      ],
    },
  ],
  commits: [
    {
      oid: 'bb3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
      parentOids: ['bb4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d'],
      subject: 'Add tags and owners to tasks',
      author: 'Fabio Fiorita',
      minutesAgo: 130,
      refs: ['HEAD', 'feat/board-filters'],
      files: [{ path: 'src/task-store.mjs', before: null, after: TASK_STORE }],
    },
    {
      oid: 'bb4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
      parentOids: [],
      subject: 'Render the board',
      author: 'Ana Souza',
      minutesAgo: 5000,
      refs: ['origin/main', 'main'],
      files: [{ path: 'src/board.mjs', before: null, after: BOARD_BEFORE }],
    },
  ],
};

const ICON_BEFORE = `import { createFileTreeIconResolver } from '@pierre/trees';

const resolver = createFileTreeIconResolver('complete');

export function iconFor(path: string) {
  return resolver.resolve(path);
}
`;

const ICON_AFTER = `import { createFileTreeIconResolver } from '@pierre/trees';

const resolver = createFileTreeIconResolver('complete');

/** Symlinks and submodules have no extension; the tree maps them by kind. */
export function iconFor(path: string, kind: 'file' | 'symlink' | 'submodule' = 'file') {
  if (kind === 'symlink') return 'link';
  if (kind === 'submodule') return 'folder-git';
  return resolver.resolve(path);
}
`;

/** A review the reviewer already ticked through: the dot is hollow green until it is committed. */
export const PORCELAIN_TREE_ICONS: WorktreeSeed = {
  files: {
    ...unchanged(FILE_CONTENTS),
    'apps/web/src/views/review/file-icons.ts': {
      head: ICON_BEFORE,
      working: ICON_AFTER,
    },
  },
  branch: { upstream: 'origin/codex/tree-icons', ahead: 0, behind: 0 },
  otherBranches: ['main'],
  review: {
    summaryHtml: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Icons for symlinks and submodules</title>${SUMMARY_STYLE}</head><body><main><div class="eyebrow"><span class="pill ok">Reviewed</span><span class="pill"><code>codex/tree-icons</code></span></div><h1>Icons for symlinks and submodules</h1><p class="lede">Tabs now show the same symbol as the tree for links and submodules, which have no extension to match by name.</p><h2>Read in this order</h2><div class="layers">${layerLink(1, 'Tabs pick icons by kind', ['Web'])}</div></main></body></html>`,
    minutesAgo: 300,
    reviewedLayers: ['c3000000-0000-4000-8000-000000000001'],
    layers: [
      {
        id: 'c3000000-0000-4000-8000-000000000001',
        title: 'Tabs pick icons by kind',
        summary:
          'A symlink or submodule has no extension, so the icon comes from its kind.',
        lanes: ['Web'],
        steps: [
          {
            id: 'c3-1',
            lane: 0,
            title: 'iconFor',
            text: 'Kind first, then the resolver by name.',
            kind: 'changed',
            path: 'apps/web/src/views/review/file-icons.ts',
            find: 'export function iconFor',
            lines: 5,
            symbol: 'iconFor',
          },
        ],
      },
    ],
  },
  threads: [],
  commits: cleanCommits('ee', 'codex/tree-icons'),
};

export const SMALL_CLEAN = (name: string, branch: string): WorktreeSeed => ({
  files: unchanged({
    'README.md': `# ${name}\n`,
    'src/index.ts': 'export const ready = true;\n',
  }),
  threads: [],
  commits: cleanCommits('cc', branch),
  branch: { upstream: `origin/${branch}`, ahead: 0, behind: 0 },
});
