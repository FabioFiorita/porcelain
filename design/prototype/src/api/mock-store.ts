import type { CommentThread } from '../contracts/comments';
import type { Device } from '../contracts/connection';
import type { Receipt } from '../contracts/git-actions';
import type { InterruptedAction } from '../contracts/git-status';
import type { DiscoveredRepository } from '../contracts/inventory';
import type { LiveNotice, LiveState } from '../contracts/live';
import type { MarkTarget } from '../contracts/marks';
import type {
  ReviewLayer,
  ReviewResponse,
  ReviewStep,
} from '../contracts/review';
import { contentFingerprint, markKey } from '../domain/review';
import { createId } from '../lib/id';
import { ENVIRONMENT_ID, PROJECT_IDS, WORKTREE_IDS } from './fixtures/ids';
import {
  FIELDNOTES_FILTERS,
  PORCELAIN_CLEAN,
  PORCELAIN_EMPTY_MATCH,
  PORCELAIN_TREE_ICONS,
  SMALL_CLEAN,
} from './fixtures/other-worktrees';
import { PORCELAIN_REBUILD } from './fixtures/porcelain-rebuild';
import type {
  CommitSeed,
  FileSeed,
  ReviewSeed,
  WorktreeSeed,
} from './fixtures/types';
import { layerFingerprint, textLines } from './mock-review';

/** A step as the server keeps it: the pointer plus the text it pointed at when published. */
export type StoredStep = Omit<ReviewStep, 'location'> & { published: string[] };
export type StoredLayer = Omit<ReviewLayer, 'steps' | 'fingerprint'> & {
  steps: StoredStep[];
};
export type StoredReview = Pick<
  ReviewResponse,
  'revision' | 'publishedAt' | 'diagram'
> & {
  summaryHtml: string;
  layers: StoredLayer[];
};

/** A thread as stored: what it pointed at when opened, and whether that was changed code. */
export type StoredThread = Omit<CommentThread, 'location' | 'snapshot'> & {
  snapshot?: { startLine: number; text: string };
  /** Opened on uncommitted lines, so it can later read "committed". */
  onChange: boolean;
};

export type StoredMark = {
  target: MarkTarget;
  fingerprint: string;
  reviewedAt: string;
};

export type WorktreeState = {
  projectId: string;
  files: Map<string, FileSeed>;
  /** Folders with nothing in them yet; any folder holding a file is implied by its paths. */
  directories: Set<string>;
  /** .gitignore matches: an exact path, or a folder ending with `/`. */
  ignored: string[];
  /** Symlinks and submodules by path. They are tree leaves, never followed. */
  links: Map<string, { kind: 'symlink' | 'submodule'; target?: string }>;
  review: StoredReview | null;
  threads: StoredThread[];
  /** Keyed by `markKey`. */
  marks: Map<string, StoredMark>;
  commits: CommitSeed[];
  branch: {
    name: string;
    upstream: string | null;
    upstreamOid: string | null;
    ahead: number;
    behind: number;
  };
  otherBranches: string[];
  stashes: { oid: string; message: string; files: Map<string, FileSeed> }[];
  /** Discarded versions, kept out of the stash list (`refs/porcelain/discarded/*`) until restored. */
  discarded: Map<string, Map<string, FileSeed>>;
  receipts: Map<string, Receipt>;
  interrupted?: InterruptedAction;
  /** A merge or rebase stopped on a conflict. */
  inProgress: 'merge' | 'rebase' | null;
  /** Mock only: the upstream commit the next pull conflicts with; History gains it when the merge or rebase finishes. */
  incoming: CommitSeed | null;
  fetchedOnce: boolean;
};

export type MockStore = ReturnType<typeof createMockStore>;

export { markKey };

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

/** Ids for records the mock server creates at runtime. */
export const mockId = createId;

export const newOid = () => contentFingerprint(mockId()).repeat(5);

/** Turns the agent's `find` text into line numbers, as the server re-finds steps on read. */
function storedReview(
  seed: ReviewSeed,
  files: Map<string, FileSeed>,
  revision: number,
): StoredReview {
  return {
    revision,
    publishedAt: minutesAgo(seed.minutesAgo),
    diagram: seed.diagram,
    summaryHtml: seed.summaryHtml,
    layers: seed.layers.map(({ steps, ...layer }) => ({
      ...layer,
      steps: steps.map(({ path, find, lines, symbol, ...step }) => {
        const text = files.get(path)?.working;
        if (text == null)
          throw new Error(`Review fixture: ${path} has no working text`);
        const fileLines = textLines(text);
        const start = fileLines.findIndex((line) => line.includes(find));
        if (start === -1)
          throw new Error(`Review fixture: "${find}" is not in ${path}`);
        const published = fileLines.slice(start, start + lines);
        return {
          ...step,
          pointer: {
            path,
            startLine: start + 1,
            endLine: start + published.length,
            symbol,
          },
          published,
        };
      }),
    })),
  };
}

function storedThreads(
  seed: WorktreeSeed,
  files: Map<string, FileSeed>,
  worktreeId: string,
): StoredThread[] {
  return seed.threads.map((thread) => {
    const messages = thread.messages.map((entry) => ({
      id: mockId(),
      body: entry.body,
      author: entry.author,
      createdAt: minutesAgo(entry.minutesAgo),
    }));
    const seen = thread.seen ?? true;
    const lastReviewerMessage = [...messages]
      .reverse()
      .find((entry) => entry.author === 'reviewer');
    const anchor = thread.anchor;
    let snapshot: StoredThread['snapshot'];
    if (anchor.kind === 'codeRange' && anchor.revision == null) {
      const text = files.get(anchor.filePath)?.working ?? '';
      const lines = textLines(text)
        .slice(anchor.startLine - 1, anchor.endLine)
        .join('\n');
      snapshot = {
        startLine: anchor.startLine,
        text: thread.snapshot ?? lines,
      };
    }
    return {
      id: thread.id,
      worktreeId,
      anchor,
      resolved: thread.resolved,
      messages,
      // Unseen means the reviewer saw up to their own last message, not the agent's reply after it.
      seenUpTo: seen
        ? (messages.at(-1)?.id ?? null)
        : (lastReviewerMessage?.id ?? null),
      snapshot,
      onChange: anchor.kind === 'codeRange',
    };
  });
}

function worktreeState(
  projectId: string,
  branch: string,
  seed: WorktreeSeed,
  worktreeId: string,
): WorktreeState {
  const files = new Map(
    Object.entries(seed.files).map(([path, file]) => [path, { ...file }]),
  );
  const review =
    seed.review == null ? null : storedReview(seed.review, files, 1);
  const state: WorktreeState = {
    projectId,
    files,
    directories: new Set<string>(),
    ignored: seed.ignored ?? [],
    links: new Map<string, { kind: 'symlink' | 'submodule'; target?: string }>([
      ...(seed.symlinks ?? []).map(
        ({ path, target }) => [path, { kind: 'symlink', target }] as const,
      ),
      ...(seed.submodules ?? []).map(
        (path) => [path, { kind: 'submodule' }] as const,
      ),
    ]),
    review,
    threads: storedThreads(seed, files, worktreeId),
    marks: new Map(),
    // Git actions rewrite History in place; a copy keeps the fixtures as they were.
    commits: structuredClone(seed.commits),
    branch: {
      ...seed.branch,
      name: `refs/heads/${branch}`,
      upstreamOid:
        seed.branch.upstream == null
          ? null
          : (seed.commits[seed.branch.ahead]?.oid ?? null),
    },
    otherBranches: seed.otherBranches ?? [],
    stashes: [],
    discarded: new Map(),
    receipts: new Map(),
    inProgress: null,
    incoming: null,
    fetchedOnce: false,
  };
  // Layers the reviewer already ticked, against the code as it is now.
  for (const layerId of seed.review?.reviewedLayers ?? []) {
    const layer = review?.layers.find((entry) => entry.id === layerId);
    if (layer == null) continue;
    const target: MarkTarget = { kind: 'layer', layerId };
    state.marks.set(markKey(target), {
      target,
      fingerprint: layerFingerprint(state, layer),
      reviewedAt: minutesAgo(240),
    });
  }
  return state;
}

/**
 * The whole fake server in memory. It resets on reload, which is the point:
 * every demo starts from the same state.
 */
export function createMockStore() {
  const noticeListeners = new Set<(notice: LiveNotice) => void>();
  const stateListeners = new Set<(state: LiveState) => void>();

  /** Prototype-panel switches: latency, failures, the next pull's conflict, the server's agent CLIs. */
  const scenario = { latencyMs: 220, failNext: false, agentClis: true };
  /** Hidden paths per project, the project-scoped `hidden` file preference. */
  const hiddenPaths = new Map<string, Set<string>>();

  const device: Device = {
    id: 'e1000000-0000-4000-8000-000000000001',
    label: 'Chrome on this Mac',
    pairedAt: minutesAgo(60 * 24 * 12),
    lastSeenAt: minutesAgo(0),
  };
  /** Pairing: `paired` until forgotten; `revoked` makes the next request fail. */
  const connection = {
    paired: true,
    revoked: false,
    live: 'connected' as LiveState,
  };

  type Project = {
    id: string;
    name: string;
    path: string;
    available: boolean;
    worktrees: { id: string; path: string; main: boolean }[];
  };
  const projects: Project[] = [
    {
      id: PROJECT_IDS.porcelain,
      name: 'porcelain',
      path: '/home/dev/code/porcelain',
      available: true,
      worktrees: [
        {
          id: WORKTREE_IDS.porcelainMain,
          path: '/home/dev/code/porcelain',
          main: true,
        },
        {
          id: WORKTREE_IDS.porcelainRebuild,
          path: '/home/dev/worktrees/porcelain-rebuild',
          main: false,
        },
        {
          id: WORKTREE_IDS.porcelainEmptyMatch,
          path: '/home/dev/worktrees/porcelain-empty-match',
          main: false,
        },
        {
          id: WORKTREE_IDS.porcelainTreeIcons,
          path: '/home/dev/worktrees/porcelain-tree-icons',
          main: false,
        },
      ],
    },
    {
      id: PROJECT_IDS.fieldnotes,
      name: 'fieldnotes',
      path: '/home/dev/code/fieldnotes',
      available: true,
      worktrees: [
        {
          id: WORKTREE_IDS.fieldnotesMain,
          path: '/home/dev/code/fieldnotes',
          main: true,
        },
        {
          id: WORKTREE_IDS.fieldnotesFilters,
          path: '/home/dev/worktrees/fieldnotes-board-filters',
          main: false,
        },
      ],
    },
    // The repository is on a disconnected drive: its worktrees cannot be listed.
    {
      id: PROJECT_IDS.atlas,
      name: 'atlas',
      path: '/media/backup/code/atlas',
      available: false,
      worktrees: [],
    },
  ];

  const worktrees = new Map<string, WorktreeState>([
    [
      WORKTREE_IDS.porcelainRebuild,
      worktreeState(
        PROJECT_IDS.porcelain,
        'codex/porcelain-rebuild',
        PORCELAIN_REBUILD,
        WORKTREE_IDS.porcelainRebuild,
      ),
    ],
    [
      WORKTREE_IDS.porcelainEmptyMatch,
      worktreeState(
        PROJECT_IDS.porcelain,
        'codex/review-layer-empty-match',
        PORCELAIN_EMPTY_MATCH,
        WORKTREE_IDS.porcelainEmptyMatch,
      ),
    ],
    [
      WORKTREE_IDS.porcelainMain,
      worktreeState(
        PROJECT_IDS.porcelain,
        'main',
        PORCELAIN_CLEAN('main'),
        WORKTREE_IDS.porcelainMain,
      ),
    ],
    [
      WORKTREE_IDS.porcelainTreeIcons,
      worktreeState(
        PROJECT_IDS.porcelain,
        'codex/tree-icons',
        PORCELAIN_TREE_ICONS,
        WORKTREE_IDS.porcelainTreeIcons,
      ),
    ],
    [
      WORKTREE_IDS.fieldnotesFilters,
      worktreeState(
        PROJECT_IDS.fieldnotes,
        'feat/board-filters',
        FIELDNOTES_FILTERS,
        WORKTREE_IDS.fieldnotesFilters,
      ),
    ],
    [
      WORKTREE_IDS.fieldnotesMain,
      worktreeState(
        PROJECT_IDS.fieldnotes,
        'main',
        SMALL_CLEAN('fieldnotes', 'main'),
        WORKTREE_IDS.fieldnotesMain,
      ),
    ],
  ]);

  const discovered: DiscoveredRepository[] = [
    { name: 'porcelain-docs', path: '/home/dev/code/porcelain-docs' },
    { name: 'fieldnotes-mobile', path: '/home/dev/code/fieldnotes-mobile' },
    { name: 'tanstack-highlight', path: '/home/dev/code/tanstack-highlight' },
  ];

  /** Folders the open-project dialog can browse. `true` marks a Git repository. */
  const filesystem: Record<string, Record<string, boolean>> = {
    '/': { home: false },
    '/home': { dev: false },
    '/home/dev': {
      code: false,
      worktrees: false,
      Documents: false,
      Downloads: false,
    },
    '/home/dev/code': {
      porcelain: true,
      'porcelain-docs': true,
      fieldnotes: true,
      'fieldnotes-mobile': true,
      atlas: true,
      'tanstack-highlight': true,
      experiments: false,
    },
    '/home/dev/code/experiments': {
      'scratch-api': true,
      'design-notes': false,
    },
    '/home/dev/code/experiments/design-notes': {},
    '/home/dev/worktrees': {
      'porcelain-rebuild': true,
      'porcelain-empty-match': true,
      'porcelain-tree-icons': true,
      'fieldnotes-board-filters': true,
    },
    '/home/dev/Documents': { notes: false },
    '/home/dev/Documents/notes': {},
    '/home/dev/Downloads': {},
  };
  const HOME = '/home/dev';

  // A burst of notices within ~150 ms reaches the app once, as the server groups them.
  let pending: LiveNotice[] = [];
  let flush: ReturnType<typeof setTimeout> | null = null;
  const emit = (notice: LiveNotice) => {
    if (connection.live !== 'connected') return;
    if (
      !pending.some((entry) => JSON.stringify(entry) === JSON.stringify(notice))
    )
      pending.push(notice);
    if (flush != null) return;
    flush = setTimeout(() => {
      const batch = pending;
      pending = [];
      flush = null;
      for (const entry of batch)
        for (const listener of noticeListeners) listener(entry);
    }, 150);
  };

  return {
    environmentId: ENVIRONMENT_ID,
    hiddenPaths,
    scenario,
    connection,
    device,
    server: { name: 'beelink', version: '0.9.0' },
    projects,
    worktrees,
    discovered,
    emit,
    subscribe(
      onNotice: (notice: LiveNotice) => void,
      onState: (state: LiveState) => void,
    ) {
      noticeListeners.add(onNotice);
      stateListeners.add(onState);
      onState(connection.live);
      return () => {
        noticeListeners.delete(onNotice);
        stateListeners.delete(onState);
      };
    },
    setLive(state: LiveState) {
      connection.live = state;
      for (const listener of stateListeners) listener(state);
    },
    filesystem,
    home: HOME,
    worktree(worktreeId: string): WorktreeState | undefined {
      return worktrees.get(worktreeId);
    },
    /** A new revision of a worktree's review, as `publish_review` would store it. */
    publish(worktreeId: string, seed: ReviewSeed) {
      const worktree = worktrees.get(worktreeId);
      if (worktree == null) return;
      worktree.review = storedReview(
        seed,
        worktree.files,
        (worktree.review?.revision ?? 0) + 1,
      );
      emit({ kind: 'review', worktreeId, revision: worktree.review.revision });
      emit({ kind: 'inventory' });
    },
    addProject(path: string) {
      const name = path.split('/').filter(Boolean).pop() ?? 'project';
      const projectId = mockId();
      const worktreeId = mockId();
      const project: Project = {
        id: projectId,
        name,
        path,
        available: true,
        worktrees: [{ id: worktreeId, path, main: true }],
      };
      projects.push(project);
      worktrees.set(
        worktreeId,
        worktreeState(projectId, 'main', SMALL_CLEAN(name, 'main'), worktreeId),
      );
      return project;
    },
  };
}
