import type { CommentThread } from '../contracts/comments';
import type { DirectoryEntry } from '../contracts/files';
import type { GitChange, GitStatusResponse } from '../contracts/git-status';
import type { ProjectResponse } from '../contracts/inventory';
import type { MarkTarget, ReviewedMark } from '../contracts/marks';
import { basename, contentFingerprint } from '../domain/review';
import { type Api, ApiError, type ReviewRequest } from './api';
import { COMMIT_MODELS } from './fixtures/models';
import { listBranches, runAction } from './mock-git';
import { unifiedPatch } from './mock-patch';
import {
  changedLines,
  changedPaths,
  fileFingerprint,
  ignoredPath,
  layerFingerprint,
  patchFor,
  reviewResponse,
  textLines,
  threadView,
  worktreeSignal,
} from './mock-review';
import {
  type MockStore,
  markKey,
  type StoredThread,
  type WorktreeState,
} from './mock-store';
import { pageUrl, summaryUrl } from './mock-summary';

/**
 * Deliberately tiny so paging shows with a handful of fixture commits. The live
 * client asks for 50.
 */
const MOCK_HISTORY_PAGE = 3;
/** Drafting a message or grouping takes a model a moment; long enough here to see the spinner. */
const GENERATE_MS = 900;

function wait(
  store: MockStore,
  signal?: AbortSignal,
  options: { minimumMs?: number; unpaired?: boolean } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        if (!options.unpaired) {
          if (store.connection.revoked) {
            reject(
              new ApiError(
                'DEVICE_REVOKED',
                'This browser was revoked on the server. Pair it again with a new link.',
              ),
            );
            return;
          }
          if (!store.connection.paired) {
            reject(
              new ApiError(
                'NOT_PAIRED',
                'This browser is not paired with this server.',
              ),
            );
            return;
          }
        }
        if (store.scenario.failNext) {
          store.scenario.failNext = false;
          reject(
            new ApiError(
              'SERVICE_UNAVAILABLE',
              'The server did not answer. Try again.',
            ),
          );
          return;
        }
        resolve();
      },
      Math.max(store.scenario.latencyMs, options.minimumMs ?? 0),
    );
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    });
  });
}

function requireWorktree(
  store: MockStore,
  request: ReviewRequest,
): WorktreeState {
  const worktree = store.worktree(request.worktreeId);
  if (worktree == null || worktree.projectId !== request.projectId) {
    throw new ApiError(
      'WORKTREE_NOT_FOUND',
      'This worktree is no longer available.',
    );
  }
  return worktree;
}

function statusToken(worktree: WorktreeState): string {
  const text = changedPaths(worktree)
    .map((path) => fileFingerprint(worktree, path))
    .join('\0');
  return contentFingerprint(
    `${text}\0${worktree.commits[0]?.oid ?? ''}`,
  ).repeat(8);
}

function status(
  store: MockStore,
  worktreeId: string,
  worktree: WorktreeState,
): GitStatusResponse {
  const changes: GitChange[] = changedPaths(worktree).map((path): GitChange => {
    const file = worktree.files.get(path);
    const fingerprint = fileFingerprint(worktree, path);
    if (file?.conflict != null)
      return { scope: 'unmerged', path, conflict: file.conflict, fingerprint };
    // A file the agent created and nobody staged is untracked, as `git status` reports it.
    if (file?.head == null && file?.staged !== true)
      return { scope: 'untracked', path, fingerprint };
    return {
      scope: file?.staged === true ? 'staged' : 'unstaged',
      kind:
        file?.head == null
          ? 'added'
          : file.working == null
            ? 'deleted'
            : 'modified',
      oldPath: file?.head == null ? null : path,
      newPath: file?.working == null ? null : path,
      oldMode: file?.head == null ? '000000' : '100644',
      newMode: file?.working == null ? '000000' : '100644',
      supported: true,
      fingerprint,
    };
  });
  return {
    environmentId: store.environmentId,
    worktreeId,
    statusToken: statusToken(worktree),
    headOid: worktree.commits[0]?.oid ?? null,
    headCommit:
      worktree.commits[0] == null
        ? null
        : {
            subject: worktree.commits[0].subject,
            body: worktree.commits[0].body,
          },
    changes,
    branch: {
      name: worktree.branch.name,
      upstream: worktree.branch.upstream,
      upstreamOid: worktree.branch.upstreamOid,
      ahead: worktree.branch.ahead,
      behind: worktree.branch.behind,
      stashes: worktree.stashes.map(({ oid, message }) => ({ oid, message })),
    },
    interrupted: worktree.interrupted,
    inProgress: worktree.inProgress,
  };
}

/** The mock's "model": a layer's title when the files are exactly its changed steps, else a subject from the paths. */
function draftMessage(
  worktree: WorktreeState,
  paths: readonly string[],
): string {
  const layers = (worktree.review?.layers ?? []).filter((layer) =>
    layer.steps.some(
      (step) => step.kind === 'changed' && paths.includes(step.pointer.path),
    ),
  );
  const [only] = layers;
  if (layers.length === 1 && only != null) {
    const covered = new Set(
      only.steps
        .filter((step) => step.kind === 'changed')
        .map((step) => step.pointer.path),
    );
    if (paths.every((path) => covered.has(path)))
      return `${only.title}\n\n${only.summary}`;
  }
  const kinds = paths.map((path) => {
    const file = worktree.files.get(path);
    return file?.head == null
      ? 'added'
      : file.working == null
        ? 'deleted'
        : 'modified';
  });
  const verb = kinds.every((kind) => kind === 'added')
    ? 'Add'
    : kinds.every((kind) => kind === 'deleted')
      ? 'Remove'
      : 'Update';
  const subject =
    paths.length <= 2
      ? `${verb} ${paths.map(basename).join(' and ')}`
      : `${verb} ${paths.length} files`;
  return layers.length === 0
    ? subject
    : `${subject}\n\n${layers.map((layer) => `- ${layer.title}`).join('\n')}`;
}

/** One commit per layer, in layer order, then the rest; without a review, one per top-level folder. */
function commitGroupsFor(
  worktree: WorktreeState,
  paths: readonly string[],
): { message: string; paths: string[] }[] {
  const groups: string[][] = [];
  const layers = worktree.review?.layers ?? [];
  if (layers.length > 0) {
    const taken = new Set<string>();
    for (const layer of layers) {
      const covered = new Set(
        layer.steps
          .filter((step) => step.kind === 'changed')
          .map((step) => step.pointer.path),
      );
      const group = paths.filter(
        (path) => !taken.has(path) && covered.has(path),
      );
      for (const path of group) taken.add(path);
      groups.push(group);
    }
    groups.push(paths.filter((path) => !taken.has(path)));
  } else {
    const byFolder = new Map<string, string[]>();
    for (const path of paths) {
      const folder = path.includes('/') ? path.slice(0, path.indexOf('/')) : '';
      byFolder.set(folder, [...(byFolder.get(folder) ?? []), path]);
    }
    groups.push(...byFolder.values());
  }
  return groups
    .filter((group) => group.length > 0)
    .map((group) => ({ message: draftMessage(worktree, group), paths: group }));
}

function requireFreshFiles(
  worktree: WorktreeState,
  files: readonly { path: string; fingerprint: string }[],
) {
  const moved = files.find(
    (file) => fileFingerprint(worktree, file.path) !== file.fingerprint,
  );
  if (moved != null)
    throw new ApiError(
      'CHANGED_SINCE_LOOKED',
      `${moved.path} changed since you looked. Look again, then retry.`,
    );
}

const withSlash = (path: string) => (path.endsWith('/') ? path : `${path}/`);

const validPath = (path: string) =>
  path.replace(/\/+$/, '') !== '' &&
  !path.startsWith('/') &&
  !path.split('/').includes('..');

function exists(worktree: WorktreeState, path: string): boolean {
  if (path.endsWith('/')) {
    return (
      worktree.directories.has(path) ||
      [...worktree.files.entries()].some(
        ([entry, file]) => file.working != null && entry.startsWith(path),
      ) ||
      [...worktree.links.keys()].some((entry) => entry.startsWith(path))
    );
  }
  return worktree.files.get(path)?.working != null || worktree.links.has(path);
}

/** `path` itself, or everything under it when it is a folder. */
const within = (path: string, target: string) =>
  path === target || (target.endsWith('/') && path.startsWith(target));

/** Every path that exists now: live files, links, and folders that hold nothing yet. */
function allPaths(worktree: WorktreeState): string[] {
  const files = [
    ...[...worktree.files.entries()]
      .filter(([, file]) => file.working != null)
      .map(([path]) => path),
    ...worktree.links.keys(),
  ];
  const empty = [...worktree.directories].filter(
    (directory) => !files.some((path) => path.startsWith(directory)),
  );
  return [...files, ...empty];
}

/** One folder's entries, as one directory read plus one `git check-ignore`. */
function listDirectory(
  worktree: WorktreeState,
  directory: string,
): DirectoryEntry[] {
  const prefix = directory === '' ? '' : withSlash(directory);
  const entries = new Map<string, DirectoryEntry>();
  for (const path of allPaths(worktree)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    if (rest === '') continue;
    const slash = rest.indexOf('/');
    const name = slash === -1 ? rest : rest.slice(0, slash);
    if (slash !== -1 && slash < rest.length - 1) {
      entries.set(name, {
        name,
        kind: 'directory',
        ignored: ignoredPath(worktree, `${prefix}${name}/`),
      });
      continue;
    }
    if (slash === rest.length - 1) {
      entries.set(name, {
        name,
        kind: 'directory',
        ignored: ignoredPath(worktree, `${prefix}${name}/`),
      });
      continue;
    }
    const link = worktree.links.get(path);
    entries.set(name, {
      name,
      kind: link?.kind ?? 'file',
      ignored: ignoredPath(worktree, path),
      ...(link?.target == null ? {} : { target: link.target }),
    });
  }
  return [...entries.values()].sort(
    (left, right) =>
      Number(right.kind === 'directory') - Number(left.kind === 'directory') ||
      left.name.localeCompare(right.name),
  );
}

/** Quick open: subsequence match on the path, basename hits first, shorter paths first. */
function searchPaths(worktree: WorktreeState, query: string): string[] {
  const needle = query.toLowerCase().replace(/\s+/g, '');
  const matches = (text: string) => {
    let index = 0;
    for (const char of text.toLowerCase())
      if (char === needle[index]) index += 1;
    return index === needle.length;
  };
  return allPaths(worktree)
    .filter((path) => !path.endsWith('/') && !ignoredPath(worktree, path))
    .filter((path) => needle === '' || matches(path))
    .sort((left, right) => {
      const leftName = Number(basename(left).toLowerCase().includes(needle));
      const rightName = Number(basename(right).toLowerCase().includes(needle));
      return (
        rightName - leftName ||
        left.length - right.length ||
        left.localeCompare(right)
      );
    });
}

function markView(
  worktree: WorktreeState,
  target: MarkTarget,
  fingerprint: string,
  reviewedAt: string,
): ReviewedMark | null {
  if (target.kind === 'layer') {
    const layer = worktree.review?.layers.find(
      (entry) => entry.id === target.layerId,
    );
    if (layer == null) return null;
    return {
      target,
      fingerprint,
      reviewedAt,
      stale: fingerprint !== layerFingerprint(worktree, layer),
    };
  }
  // Marks of committed code are ignored (and cleaned up by the server later).
  if (!changedPaths(worktree).includes(target.path)) return null;
  return {
    target,
    fingerprint,
    reviewedAt,
    stale: fingerprint !== fileFingerprint(worktree, target.path),
  };
}

function projectResponse(
  store: MockStore,
  project: MockStore['projects'][number],
): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    available: project.available,
    worktrees: project.available
      ? project.worktrees.flatMap((entry) => {
          const state = store.worktree(entry.id);
          if (state == null) return [];
          return [
            {
              id: entry.id,
              path: entry.path,
              main: entry.main,
              branch: state.branch.name,
              signal: worktreeSignal(state),
            },
          ];
        })
      : [],
  };
}

export function createMockApi(store: MockStore): Api {
  const threadsOf = (worktree: WorktreeState): CommentThread[] =>
    worktree.threads.map((thread) => threadView(worktree, thread));
  const findThread = (
    worktree: WorktreeState,
    threadId: string,
  ): StoredThread => {
    const thread = worktree.threads.find((entry) => entry.id === threadId);
    if (thread == null)
      throw new ApiError('COMMENT_NOT_FOUND', 'That thread was removed.');
    return thread;
  };
  const threadChanged = (worktreeId: string, threadId: string) => {
    store.emit({ kind: 'comments', worktreeId, threadId });
    store.emit({ kind: 'inventory' });
  };
  const filesChanged = (worktreeId: string, paths: string[]) => {
    store.emit({ kind: 'files', worktreeId, paths });
    store.emit({
      kind: 'review',
      worktreeId,
      revision: store.worktree(worktreeId)?.review?.revision ?? null,
    });
    store.emit({ kind: 'marks', worktreeId });
    store.emit({ kind: 'inventory' });
  };

  return {
    connection: {
      async session({ signal }) {
        await wait(store, signal);
        return {
          device: { ...store.device, lastSeenAt: new Date().toISOString() },
          server: store.server,
        };
      },
      async pair({ code, label }) {
        await wait(store, undefined, { unpaired: true });
        const trimmed = code.trim();
        if (trimmed === '')
          throw new ApiError(
            'INVALID_REQUEST',
            'Paste the pairing link from `porcelain pair`.',
          );
        if (trimmed.includes('expired'))
          throw new ApiError(
            'PAIRING_LINK_EXPIRED',
            'This pairing link expired. Links last 15 minutes: run `porcelain pair` again.',
          );
        if (trimmed.includes('used'))
          throw new ApiError(
            'PAIRING_LINK_USED',
            'This pairing link was already used. Each link pairs one device: run `porcelain pair` again.',
          );
        store.connection.paired = true;
        store.connection.revoked = false;
        store.device.label = label.trim() || store.device.label;
        store.device.pairedAt = new Date().toISOString();
        return { device: { ...store.device }, server: store.server };
      },
      async forget() {
        await wait(store);
        store.connection.paired = false;
      },
    },

    inventory: {
      async read({ signal }) {
        await wait(store, signal);
        return {
          environmentId: store.environmentId,
          projects: store.projects.map((project) =>
            projectResponse(store, project),
          ),
        };
      },
      async register({ path }) {
        await wait(store);
        const trimmed = path.trim().replace(/\/+$/, '');
        if (
          trimmed === '' ||
          (!trimmed.startsWith('/') && !trimmed.startsWith('~'))
        ) {
          throw new ApiError(
            'INVALID_PATH',
            'Enter an absolute path to a Git repository.',
          );
        }
        const parentPath = trimmed.slice(0, trimmed.lastIndexOf('/')) || '/';
        const folder = trimmed.split('/').pop() ?? '';
        if (store.filesystem[parentPath]?.[folder] === false) {
          throw new ApiError(
            'NOT_A_REPOSITORY',
            `${folder} is a folder, but not a Git repository.`,
          );
        }
        const existing = store.projects.find((project) =>
          project.worktrees.some((worktree) => worktree.path === trimmed),
        );
        if (existing != null)
          throw new ApiError(
            'PROJECT_EXISTS',
            `${existing.name} is already open.`,
          );
        const project = store.addProject(trimmed);
        store.emit({ kind: 'inventory' });
        return projectResponse(store, project);
      },
      async remove({ projectId }) {
        await wait(store);
        const index = store.projects.findIndex(
          (project) => project.id === projectId,
        );
        if (index === -1) return { deleted: false };
        const [project] = store.projects.splice(index, 1);
        for (const worktree of project?.worktrees ?? [])
          store.worktrees.delete(worktree.id);
        store.emit({ kind: 'inventory' });
        return { deleted: true };
      },
      async rename({ projectId, name }) {
        await wait(store);
        const project = store.projects.find((entry) => entry.id === projectId);
        if (project == null)
          throw new ApiError('PROJECT_NOT_FOUND', 'That project was removed.');
        const trimmed = name.trim();
        if (trimmed === '' || trimmed.length > 100)
          throw new ApiError(
            'INVALID_REQUEST',
            'A project name needs 1 to 100 characters.',
          );
        project.name = trimmed;
        store.emit({ kind: 'inventory' });
        return projectResponse(store, project);
      },
      async browse({ path, signal }) {
        await wait(store, signal);
        const target = (path ?? store.home).replace(/\/+$/, '') || '/';
        const children = store.filesystem[target];
        if (children == null)
          throw new ApiError(
            'DIRECTORY_NOT_FOUND',
            `${target} does not exist.`,
          );
        const parentPath =
          target === '/'
            ? null
            : target.slice(0, target.lastIndexOf('/')) || '/';
        const join = (name: string) =>
          target === '/' ? `/${name}` : `${target}/${name}`;
        const openPaths = new Set(
          store.projects.flatMap((project) =>
            project.worktrees.map((worktree) => worktree.path),
          ),
        );
        const parentEntries =
          parentPath == null ? undefined : store.filesystem[parentPath];
        const name = target.split('/').pop() ?? '';
        return {
          path: target,
          parent: parentPath,
          isRepository: parentEntries?.[name] === true,
          entries: Object.entries(children)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([entry, isRepository]) => ({
              name: entry,
              path: join(entry),
              isRepository,
              open: openPaths.has(join(entry)),
            })),
        };
      },
      async discover() {
        await wait(store);
        const open = new Set(
          store.projects.flatMap((project) =>
            project.worktrees.map((worktree) => worktree.path),
          ),
        );
        return store.discovered.filter(
          (repository) => !open.has(repository.path),
        );
      },
    },

    review: {
      async changes(request) {
        await wait(store, request.signal);
        return status(
          store,
          request.worktreeId,
          requireWorktree(store, request),
        );
      },
      async diff(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const change = request.input.change;
        const path =
          change.scope === 'untracked'
            ? change.path
            : (change.newPath ?? change.oldPath ?? '');
        const file = worktree.files.get(path);
        if (file == null)
          throw new ApiError(
            'FILE_NOT_FOUND',
            `${path} is not in this worktree.`,
          );
        return {
          worktreeId: request.worktreeId,
          change: request.input.change,
          oldMode: '100644',
          newMode: '100644',
          content:
            file.binary != null
              ? { kind: 'binary' }
              : { kind: 'text', patch: patchFor(worktree, path) },
        };
      },
      async range(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const { path, at, startLine, endLine } = request.input;
        const file = worktree.files.get(path);
        const text = at === 'head' ? file?.head : file?.working;
        if (text == null)
          throw new ApiError(
            'FILE_NOT_FOUND',
            `${path} does not exist ${at === 'head' ? 'at the last commit' : 'on disk'}.`,
          );
        return {
          path,
          at,
          startLine,
          lines: textLines(text).slice(startLine - 1, endLine),
        };
      },
      async review(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const url =
          worktree.review == null
            ? ''
            : await summaryUrl(worktree.review.summaryHtml);
        return reviewResponse(worktree, request.worktreeId, url);
      },
      async history(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const limit = request.limit ?? MOCK_HISTORY_PAGE;
        let start = 0;
        if (request.before != null) {
          const index = worktree.commits.findIndex(
            (commit) => commit.oid === request.before,
          );
          if (index === -1)
            throw new ApiError(
              'HISTORY_REWRITTEN',
              'The branch history was rewritten since this list loaded.',
            );
          start = index + 1;
        }
        const now = Date.now();
        return {
          head: { kind: 'attached', ref: worktree.branch.name },
          commits: worktree.commits
            .slice(start, start + limit)
            .map((commit) => ({
              oid: commit.oid,
              parentOids: commit.parentOids,
              author: {
                name: commit.author,
                timestamp: new Date(
                  now - commit.minutesAgo * 60_000,
                ).toISOString(),
              },
              subject: commit.subject,
              subjectTruncated: false,
              body: commit.body,
              refs: commit.refs,
            })),
          hasMore: start + limit < worktree.commits.length,
          boundary: null,
        };
      },
      async commitFiles(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const commit = worktree.commits.find(
          (entry) => entry.oid === request.oid,
        );
        if (commit == null)
          throw new ApiError(
            'COMMIT_NOT_FOUND',
            'That commit is not in this history.',
          );
        const parent = request.parent ?? 1;
        const baseOid = commit.parentOids[parent - 1];
        if (
          !(parent === 1 && commit.parentOids.length === 0) &&
          baseOid == null
        ) {
          throw new ApiError(
            'INVALID_REQUEST',
            `This commit has no parent ${parent}.`,
          );
        }
        const files =
          parent === 1 ? commit.files : (commit.filesByParent?.[parent] ?? []);
        return {
          commitOid: commit.oid,
          commit: {
            oid: commit.oid,
            parentOids: commit.parentOids,
            author: {
              name: commit.author,
              timestamp: new Date(
                Date.now() - commit.minutesAgo * 60_000,
              ).toISOString(),
            },
            subject: commit.subject,
            subjectTruncated: false,
            body: commit.body,
            refs: commit.refs,
          },
          parentOids: commit.parentOids,
          comparison:
            baseOid == null
              ? { kind: 'empty-tree' }
              : { kind: 'parent', parentNumber: parent, baseOid },
          files: files.map((file) => ({
            oldPath: file.before == null ? null : file.path,
            newPath: file.after == null ? null : file.path,
            status:
              file.before == null
                ? 'added'
                : file.after == null
                  ? 'deleted'
                  : 'modified',
            oldMode: file.before == null ? '000000' : '100644',
            newMode: file.after == null ? '000000' : '100644',
          })),
        };
      },
      async commitDiff(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const commit = worktree.commits.find(
          (entry) => entry.oid === request.oid,
        );
        const parent = request.parent ?? 1;
        const files =
          commit == null
            ? []
            : parent === 1
              ? commit.files
              : (commit.filesByParent?.[parent] ?? []);
        const file = files.find((entry) => entry.path === request.path);
        if (commit == null || file == null)
          throw new ApiError(
            'COMMIT_NOT_FOUND',
            'That file is not in this commit.',
          );
        return {
          commitOid: commit.oid,
          path: file.path,
          patch: {
            kind: 'text',
            text: unifiedPatch(file.path, file.before, file.after),
          },
        };
      },
    },

    files: {
      async text(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const file = worktree.files.get(request.path);
        const text = file?.working;
        if (text == null)
          throw new ApiError(
            'FILE_NOT_FOUND',
            `${request.path} does not exist.`,
          );
        if (file?.unreadable === 'unsupported-text' || file?.binary != null)
          throw new ApiError(
            'UNSUPPORTED_TEXT',
            'File is not supported UTF-8 text',
          );
        if (file?.unreadable === 'too-large')
          throw new ApiError('FILE_TOO_LARGE', 'File exceeds the read limit');
        return {
          worktreeId: request.worktreeId,
          path: request.path,
          encoding: 'utf-8',
          byteLength: new TextEncoder().encode(text).byteLength,
          text,
          fingerprint: contentFingerprint(text),
        };
      },
      async directory(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const path = request.path.replace(/\/+$/, '');
        if (path !== '' && !exists(worktree, withSlash(path)))
          throw new ApiError('DIRECTORY_NOT_FOUND', `${path} does not exist.`);
        return {
          worktreeId: request.worktreeId,
          path,
          entries: listDirectory(worktree, path),
        };
      },
      async search(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const paths = searchPaths(worktree, request.query);
        return {
          worktreeId: request.worktreeId,
          query: request.query,
          paths: paths.slice(0, 50),
          truncated: paths.length > 50,
        };
      },
      async previewLink(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const file = worktree.files.get(request.path);
        // Mock only: a revision other than HEAD reads what that commit's seed wrote.
        const content =
          request.revision == null
            ? file?.working
            : request.revision === 'HEAD'
              ? file?.head
              : worktree.commits
                  .find((commit) => commit.oid === request.revision)
                  ?.files.find((entry) => entry.path === request.path)?.after;
        if (content == null)
          throw new ApiError(
            'FILE_NOT_FOUND',
            `${request.path} does not exist.`,
          );
        if (file?.binary != null)
          return {
            url: await pageUrl(content, {
              type: file.binary.mime,
              base64: true,
            }),
          };
        const type = request.path.toLowerCase().endsWith('.svg')
          ? 'image/svg+xml'
          : 'text/html';
        return { url: await pageUrl(content, { type }) };
      },
      async write(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const { path, text, expectedFingerprint } = request.input;
        const file = worktree.files.get(path);
        if (file?.working == null)
          throw new ApiError('FILE_NOT_FOUND', `${path} does not exist.`);
        if (file.unreadable != null)
          throw new ApiError(
            'UNSUPPORTED_TEXT',
            'File is not supported UTF-8 text',
          );
        if (contentFingerprint(file.working) !== expectedFingerprint) {
          throw new ApiError(
            'FILE_CHANGED',
            `${path} changed on disk since you opened it. Reload it before saving.`,
          );
        }
        file.working = text;
        filesChanged(request.worktreeId, [path]);
        return {
          worktreeId: request.worktreeId,
          path,
          encoding: 'utf-8',
          byteLength: new TextEncoder().encode(text).byteLength,
          text,
          fingerprint: contentFingerprint(text),
        };
      },
      async create(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const { kind } = request.input;
        const path =
          kind === 'directory'
            ? withSlash(request.input.path)
            : request.input.path.replace(/\/+$/, '');
        if (!validPath(path))
          throw new ApiError(
            'INVALID_PATH',
            'Names cannot be empty, absolute or contain "..".',
          );
        if (exists(worktree, path))
          throw new ApiError('PATH_EXISTS', `${path} already exists.`);
        if (kind === 'directory') worktree.directories.add(path);
        else worktree.files.set(path, { head: null, working: '' });
        filesChanged(request.worktreeId, [path]);
        return { worktreeId: request.worktreeId, changed: [path] };
      },
      async move(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const { from, to } = request.input;
        const folder = from.endsWith('/');
        const target = folder ? withSlash(to) : to.replace(/\/+$/, '');
        if (!validPath(target))
          throw new ApiError(
            'INVALID_PATH',
            'Names cannot be empty, absolute or contain "..".',
          );
        if (target === from)
          return { worktreeId: request.worktreeId, changed: [] };
        if (folder && target.startsWith(from))
          throw new ApiError(
            'INVALID_MOVE',
            'A folder cannot move inside itself.',
          );
        if (exists(worktree, target))
          throw new ApiError('PATH_EXISTS', `${target} already exists.`);
        const sources = folder
          ? [...worktree.files.keys()].filter((path) => path.startsWith(from))
          : [from];
        const links = [...worktree.links.keys()].filter((path) =>
          within(path, from),
        );
        if (
          sources.length === 0 &&
          links.length === 0 &&
          !worktree.directories.has(from)
        ) {
          throw new ApiError('FILE_NOT_FOUND', `${from} does not exist.`);
        }
        const changed: string[] = [];
        for (const source of sources) {
          const file = worktree.files.get(source);
          if (file?.working == null) continue;
          const destination = folder
            ? target + source.slice(from.length)
            : target;
          // Git sees a move as the old path deleted and the new path added.
          if (file.head == null) worktree.files.delete(source);
          else
            worktree.files.set(source, {
              head: file.head,
              working: null,
              binary: file.binary,
            });
          worktree.files.set(destination, {
            head: null,
            working: file.working,
            unreadable: file.unreadable,
            binary: file.binary,
          });
          changed.push(source, destination);
        }
        for (const source of links) {
          const link = worktree.links.get(source);
          worktree.links.delete(source);
          if (link != null)
            worktree.links.set(
              folder ? target + source.slice(from.length) : target,
              link,
            );
        }
        for (const directory of [...worktree.directories]) {
          if (directory.startsWith(from)) {
            worktree.directories.delete(directory);
            worktree.directories.add(target + directory.slice(from.length));
          }
        }
        if (folder) changed.push(from, target);
        filesChanged(request.worktreeId, changed);
        return { worktreeId: request.worktreeId, changed };
      },
      async remove(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const { path } = request.input;
        const folder = path.endsWith('/');
        const targets = folder
          ? [...worktree.files.keys()].filter((entry) => entry.startsWith(path))
          : [path];
        if (!exists(worktree, path))
          throw new ApiError('FILE_NOT_FOUND', `${path} does not exist.`);
        for (const entry of targets) {
          const file = worktree.files.get(entry);
          if (file == null) continue;
          if (file.head == null) worktree.files.delete(entry);
          else file.working = null;
        }
        for (const link of [...worktree.links.keys()]) {
          if (within(link, path)) worktree.links.delete(link);
        }
        for (const directory of [...worktree.directories]) {
          if (directory.startsWith(path))
            worktree.directories.delete(directory);
        }
        const changed = folder ? [...targets, path] : targets;
        filesChanged(request.worktreeId, changed);
        return { worktreeId: request.worktreeId, changed };
      },
    },

    marks: {
      async list(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        return {
          worktreeId: request.worktreeId,
          marks: [...worktree.marks.values()].flatMap((mark) => {
            const view = markView(
              worktree,
              mark.target,
              mark.fingerprint,
              mark.reviewedAt,
            );
            return view == null ? [] : [view];
          }),
        };
      },
      async set(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const reviewedAt = new Date().toISOString();
        for (const mark of request.input.marks) {
          if (mark.reviewed)
            worktree.marks.set(markKey(mark.target), {
              target: mark.target,
              fingerprint: mark.fingerprint,
              reviewedAt,
            });
          else worktree.marks.delete(markKey(mark.target));
        }
        store.emit({ kind: 'marks', worktreeId: request.worktreeId });
        store.emit({ kind: 'inventory' });
        return this.list(request);
      },
    },

    filePreferences: {
      async list({ projectId, signal }) {
        await wait(store, signal);
        return {
          preferences: [...(store.hiddenPaths.get(projectId) ?? [])].map(
            (path) => ({ path, hidden: true }),
          ),
        };
      },
      async set({ projectId, input }) {
        await wait(store);
        const hidden = store.hiddenPaths.get(projectId) ?? new Set<string>();
        if (input.value) hidden.add(input.path);
        else hidden.delete(input.path);
        store.hiddenPaths.set(projectId, hidden);
        return {
          preferences: [...hidden].map((path) => ({ path, hidden: true })),
        };
      },
    },

    comments: {
      async list(request) {
        await wait(store, request.signal);
        return threadsOf(requireWorktree(store, request));
      },
      async create(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const { threadId, messageId, anchor } = request.input;
        const existing = worktree.threads.find(
          (entry) => entry.id === threadId,
        );
        // A retry after a dropped response gets the thread it already made.
        if (existing != null) return threadView(worktree, existing);
        const body = request.input.body.trim();
        if (body === '')
          throw new ApiError('INVALID_COMMENT', 'A comment needs a message.');
        let snapshot: StoredThread['snapshot'];
        let onChange = false;
        if (anchor.kind === 'codeRange' && anchor.revision == null) {
          const file = worktree.files.get(anchor.filePath);
          const text = anchor.side === 'deletions' ? file?.head : file?.working;
          snapshot = {
            startLine: anchor.startLine,
            text: textLines(text ?? '')
              .slice(anchor.startLine - 1, anchor.endLine)
              .join('\n'),
          };
          const changed = changedLines(file);
          onChange =
            anchor.side === 'deletions' ||
            [...changed].some(
              (line) => line >= anchor.startLine && line <= anchor.endLine,
            );
        }
        const thread: StoredThread = {
          id: threadId,
          worktreeId: request.worktreeId,
          anchor,
          resolved: false,
          messages: [
            {
              id: messageId,
              body,
              author: 'reviewer',
              createdAt: new Date().toISOString(),
            },
          ],
          seenUpTo: messageId,
          snapshot,
          onChange,
        };
        worktree.threads.push(thread);
        threadChanged(request.worktreeId, threadId);
        return threadView(worktree, thread);
      },
      async reply(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const thread = findThread(worktree, request.threadId);
        if (
          !thread.messages.some((entry) => entry.id === request.input.messageId)
        ) {
          const body = request.input.body.trim();
          if (body === '')
            throw new ApiError('INVALID_COMMENT', 'A reply needs a message.');
          thread.messages.push({
            id: request.input.messageId,
            body,
            author: 'reviewer',
            createdAt: new Date().toISOString(),
          });
          thread.seenUpTo = request.input.messageId;
          thread.resolved = false;
          threadChanged(request.worktreeId, thread.id);
        }
        return threadView(worktree, thread);
      },
      async resolve(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const thread = findThread(worktree, request.threadId);
        thread.resolved = request.input.resolved;
        threadChanged(request.worktreeId, thread.id);
        return threadView(worktree, thread);
      },
      async seen(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        const thread = findThread(worktree, request.threadId);
        const index = thread.messages.findIndex(
          (entry) => entry.id === request.input.messageId,
        );
        const current = thread.messages.findIndex(
          (entry) => entry.id === thread.seenUpTo,
        );
        if (index > current) {
          thread.seenUpTo = request.input.messageId;
          threadChanged(request.worktreeId, thread.id);
        }
        return threadView(worktree, thread);
      },
    },

    gitActions: {
      async run(request) {
        await wait(store, request.signal);
        requireWorktree(store, request);
        return runAction(store, request.worktreeId, request.input);
      },
      async receipt(request) {
        await wait(store, request.signal);
        const receipt = requireWorktree(store, request).receipts.get(
          request.requestId,
        );
        if (receipt == null)
          throw new ApiError('REQUEST_NOT_FOUND', 'No record of that request.');
        return structuredClone(receipt);
      },
      async dismissInterrupted(request) {
        await wait(store, request.signal);
        const worktree = requireWorktree(store, request);
        if (worktree.interrupted?.requestId === request.requestId)
          worktree.interrupted = undefined;
        store.emit({ kind: 'branch', worktreeId: request.worktreeId });
      },
      async branches(request) {
        await wait(store, request.signal);
        return listBranches(store, requireWorktree(store, request));
      },
      async commitModels({ signal }) {
        await wait(store, signal);
        return store.scenario.agentClis ? structuredClone(COMMIT_MODELS) : [];
      },
      async commitMessage(request) {
        await wait(store, request.signal, { minimumMs: GENERATE_MS });
        const worktree = requireWorktree(store, request);
        requireFreshFiles(worktree, request.input.files);
        const paths = request.input.files.map((file) => file.path);
        if (paths.length === 0)
          throw new ApiError(
            'INVALID_REQUEST',
            'Pick at least one changed file.',
          );
        return { message: draftMessage(worktree, paths) };
      },
      async commitGroups(request) {
        await wait(store, request.signal, { minimumMs: GENERATE_MS });
        const worktree = requireWorktree(store, request);
        requireFreshFiles(worktree, request.input.files);
        return {
          groups: commitGroupsFor(
            worktree,
            request.input.files.map((file) => file.path),
          ),
        };
      },
    },

    live: {
      connect({ onNotice, onState }) {
        return store.subscribe(onNotice, onState);
      },
    },
  };
}
