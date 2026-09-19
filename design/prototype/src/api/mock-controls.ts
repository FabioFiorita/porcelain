import { structuredPatch } from 'diff';
import type { CommentAnchor } from '../contracts/comments';
import { anchorLabel } from '../domain/comments';
import { basename } from '../domain/review';
import { SMALL_CLEAN } from './fixtures/other-worktrees';
import { agentAnswer, agentWalkthrough } from './mock-agent';
import { commitOnHead } from './mock-git';
import {
  changedPaths,
  stepLocation,
  textLines,
  threadView,
} from './mock-review';
import {
  type MockStore,
  mockId,
  newOid,
  type StoredThread,
  type WorktreeState,
} from './mock-store';

/**
 * Prototype-only controls, reached from the Prototype panel. Each one plays
 * something only an agent, Git or the network would do, and announces it on the
 * live channel exactly as the server's watchers would.
 */

const message = (body: string) => ({
  id: mockId(),
  author: 'agent' as const,
  body,
  createdAt: new Date().toISOString(),
});

/** The first run of added lines (at most three) that no thread on the file covers yet. */
function addedBlock(
  path: string,
  file: { head: string | null; working: string },
  existing: readonly StoredThread[],
): Extract<CommentAnchor, { kind: 'codeRange' }> | null {
  const taken = existing.flatMap((thread) =>
    thread.anchor.kind === 'codeRange' &&
    thread.anchor.filePath === path &&
    thread.anchor.revision == null
      ? [[thread.anchor.startLine, thread.anchor.endLine] as const]
      : [],
  );
  const runs: number[][] = [];
  for (const hunk of structuredPatch(
    path,
    path,
    file.head ?? '',
    file.working,
    '',
    '',
    { context: 0 },
  ).hunks) {
    let line = hunk.newStart;
    let run: number[] = [];
    for (const text of hunk.lines) {
      if (text.startsWith('+')) {
        if (text.slice(1).trim() !== '') run.push(line);
        line += 1;
      } else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
  }
  for (const run of runs) {
    const startLine = run[0] as number;
    const endLine = run[Math.min(run.length, 3) - 1] as number;
    if (taken.some(([start, end]) => startLine <= end && endLine >= start))
      continue;
    return {
      kind: 'codeRange',
      filePath: path,
      startLine,
      endLine,
      side: 'additions',
    };
  }
  return null;
}

/** Files in review order: those the layers' changed steps point at first, then the rest. */
function reviewOrder(worktree: WorktreeState): string[] {
  const stepped = (worktree.review?.layers ?? []).flatMap((layer) =>
    layer.steps
      .filter((step) => step.kind === 'changed')
      .map((step) => step.pointer.path),
  );
  const changed = changedPaths(worktree);
  return [
    ...new Set([
      ...stepped.filter((path) => changed.includes(path)),
      ...changed,
    ]),
  ];
}

export function createMockControls(store: MockStore) {
  const worktreeOf = (worktreeId: string) => store.worktree(worktreeId);
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
    /**
     * The reviewer told the agent to read its comments: `list_comments` gave it the
     * threads waiting for it, and it answers each. The replies are unseen, so the
     * worktree's dot turns yellow.
     */
    agentRepliesToComments(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (worktree == null) return 0;
      const waiting = worktree.threads.filter(
        (thread) =>
          !thread.resolved && thread.messages.at(-1)?.author === 'reviewer',
      );
      for (const thread of waiting) {
        thread.messages.push(
          message(agentAnswer(threadView(worktree, thread))),
        );
        store.emit({ kind: 'comments', worktreeId, threadId: thread.id });
      }
      if (waiting.length > 0) store.emit({ kind: 'inventory' });
      return waiting.length;
    },

    /** The reviewer asked "how was this done?": the agent comments on up to three added blocks, in review order. */
    agentAddsComments(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (worktree == null) return [];
      const added: string[] = [];
      for (const path of reviewOrder(worktree)) {
        if (added.length === 3) break;
        const file = worktree.files.get(path);
        if (file?.working == null || file.unreadable != null) continue;
        const anchor = addedBlock(
          path,
          { head: file.head, working: file.working },
          worktree.threads,
        );
        if (anchor == null) continue;
        const lines = textLines(file.working).slice(
          anchor.startLine - 1,
          anchor.endLine,
        );
        const first = message(agentWalkthrough(path, lines));
        const thread: StoredThread = {
          id: mockId(),
          worktreeId,
          anchor,
          resolved: false,
          messages: [first],
          seenUpTo: null,
          snapshot: { startLine: anchor.startLine, text: lines.join('\n') },
          onChange: true,
        };
        worktree.threads.push(thread);
        store.emit({ kind: 'comments', worktreeId, threadId: thread.id });
        added.push(`${basename(path)} ${anchorLabel(anchor)}`);
      }
      if (added.length > 0) store.emit({ kind: 'inventory' });
      return added;
    },

    /**
     * The agent adds lines above a step's code. Steps and comments are re-found at
     * their new lines, but the layer's code did not change, so its tick holds.
     */
    agentMovesCode(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      const step = worktree?.review?.layers[0]?.steps.find(
        (entry) => entry.kind === 'changed',
      );
      const file =
        step == null ? undefined : worktree?.files.get(step.pointer.path);
      if (worktree == null || step == null || file?.working == null)
        return null;
      const lines = textLines(file.working);
      const location = stepLocation(worktree, step);
      const at = location.state === 'changed' ? 0 : location.startLine - 1;
      lines.splice(
        at,
        0,
        '// Moved down by the agent: two lines added above.',
        '',
      );
      file.working = `${lines.join('\n')}\n`;
      filesChanged(worktreeId, [step.pointer.path]);
      return step.pointer.path;
    },

    /**
     * The agent rewrites a line inside a step: that step reads "Code changed since
     * the review was written", and a tick on its layer goes stale.
     */
    agentRewritesStep(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      const step = worktree?.review?.layers[0]?.steps.find(
        (entry) => entry.kind === 'changed',
      );
      const file =
        step == null ? undefined : worktree?.files.get(step.pointer.path);
      if (worktree == null || step == null || file?.working == null)
        return null;
      const location = stepLocation(worktree, step);
      if (location.state === 'changed') return null;
      const lines = textLines(file.working);
      const index = location.startLine;
      lines[index] = `${lines[index] ?? ''} // rewritten by the agent`;
      file.working = `${lines.join('\n')}\n`;
      filesChanged(worktreeId, [step.pointer.path]);
      return step.title;
    },

    /** The agent publishes the review again from the code as it is now (`publish_review`). */
    agentRepublishes(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      const review = worktree?.review;
      if (worktree == null || review == null) return null;
      for (const step of review.layers.flatMap((layer) => layer.steps)) {
        const location = stepLocation(worktree, step);
        const text = worktree.files.get(step.pointer.path)?.working ?? '';
        const lines = textLines(text);
        if (location.state === 'changed') {
          step.published = lines.slice(
            step.pointer.startLine - 1,
            step.pointer.startLine - 1 + step.published.length,
          );
        } else {
          step.pointer = {
            ...step.pointer,
            startLine: location.startLine,
            endLine: location.endLine,
          };
        }
      }
      review.revision += 1;
      review.publishedAt = new Date().toISOString();
      store.emit({ kind: 'review', worktreeId, revision: review.revision });
      store.emit({ kind: 'marks', worktreeId });
      store.emit({ kind: 'inventory' });
      return review.revision;
    },

    /**
     * The agent commits the first layer's files in its own session, outside Porcelain.
     * The watcher on the Git folder notices; those steps fold as "Committed".
     */
    agentCommitsFirstLayer(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      const layer = worktree?.review?.layers[0];
      if (worktree == null || layer == null) return null;
      const paths = [
        ...new Set(
          layer.steps
            .filter((step) => step.kind === 'changed')
            .map((step) => step.pointer.path),
        ),
      ].filter((path) => changedPaths(worktree).includes(path));
      if (paths.length === 0) return null;
      const files = paths.map((path) => {
        const file = worktree.files.get(path);
        return {
          path,
          before: file?.head ?? null,
          after: file?.working ?? null,
        };
      });
      for (const path of paths) {
        const file = worktree.files.get(path);
        if (file?.working == null) worktree.files.delete(path);
        else file.head = file.working;
      }
      commitOnHead(worktree, {
        oid: newOid(),
        subject: layer.title,
        body: layer.summary,
        author: 'Fabio Fiorita',
        files,
      });
      worktree.branch.ahead += 1;
      store.emit({ kind: 'branch', worktreeId });
      filesChanged(worktreeId, paths);
      return layer.title;
    },

    /** The agent rebases its branch: every commit id changes, so an older page restarts from the top. */
    agentRewritesHistory(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (worktree == null || worktree.commits.length === 0) return false;
      const renamed = new Map(
        worktree.commits.map((commit) => [commit.oid, newOid()]),
      );
      worktree.commits = worktree.commits.map((commit) => ({
        ...commit,
        oid: renamed.get(commit.oid) ?? commit.oid,
        parentOids: commit.parentOids.map((oid) => renamed.get(oid) ?? oid),
      }));
      store.emit({ kind: 'branch', worktreeId });
      return true;
    },

    /** The agent runs `git worktree add` for a new task: the navigator shows it without a refresh. */
    agentCreatesWorktree(projectId: string) {
      const project = store.projects.find((entry) => entry.id === projectId);
      if (project == null || !project.available) return null;
      const branch = `codex/task-${project.worktrees.length + 1}`;
      const worktreeId = mockId();
      const seed = SMALL_CLEAN(project.name, branch);
      project.worktrees.push({
        id: worktreeId,
        path: `/home/dev/worktrees/${project.name}-task-${project.worktrees.length + 1}`,
        main: false,
      });
      const template = [...store.worktrees.values()].find(
        (entry) => entry.projectId === projectId,
      );
      store.worktrees.set(worktreeId, {
        ...(template as WorktreeState),
        projectId,
        files: new Map(
          Object.entries(seed.files).map(([path, file]) => [path, { ...file }]),
        ),
        review: null,
        threads: [],
        marks: new Map(),
        commits: seed.commits,
        branch: {
          name: `refs/heads/${branch}`,
          upstream: null,
          upstreamOid: null,
          ahead: 0,
          behind: 0,
        },
        otherBranches: [],
        stashes: [],
        discarded: new Map(),
        receipts: new Map(),
        interrupted: undefined,
        inProgress: null,
        incoming: null,
        directories: new Set(),
        links: new Map(),
      });
      store.emit({ kind: 'inventory' });
      return branch;
    },

    /** The agent writes to a file the reviewer has open, so the reader follows the disk. */
    agentEditsFile(worktreeId: string, path: string) {
      const file = worktreeOf(worktreeId)?.files.get(path);
      if (file?.working == null || file.unreadable != null) return null;
      file.working = `${file.working.replace(/\n?$/, '\n')}// Touched by the agent at ${new Date().toLocaleTimeString()}.\n`;
      filesChanged(worktreeId, [path]);
      return path;
    },

    /** The server restarts while a push runs: the action is shown once as interrupted. */
    serverRestartsDuringPush(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (worktree == null) return false;
      worktree.interrupted = {
        requestId: mockId(),
        action: 'push',
        gitState: null,
      };
      store.setLive('reconnecting');
      setTimeout(() => {
        store.setLive('connected');
        store.emit({ kind: 'branch', worktreeId });
      }, 2500);
      return true;
    },

    /** The connection drops (laptop sleep, Wi-Fi): the app shows it, reconnects and re-checks what is on screen. */
    dropConnection(seconds = 3) {
      store.setLive('reconnecting');
      setTimeout(() => store.setLive('connected'), seconds * 1000);
    },

    /** The owner ran `porcelain revoke` for this browser: its next request fails. */
    revokeThisDevice() {
      store.connection.revoked = true;
      store.emit({ kind: 'inventory' });
    },

    /**
     * Sets up a pull that stops on a conflict, as Git would: the agent commits a README
     * change here while the upstream changed the same lines. Pull then merges or
     * rebases, following the Pull setting.
     */
    nextPullConflicts(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (
        worktree == null ||
        worktree.branch.upstream == null ||
        worktree.inProgress != null
      )
        return null;
      const path = [...worktree.files.keys()].find(
        (entry) => entry.toLowerCase() === 'readme.md',
      );
      const file = path == null ? undefined : worktree.files.get(path);
      if (path == null || file?.head == null || file.working !== file.head)
        return null;
      const base = file.head.endsWith('\n') ? file.head : `${file.head}\n`;
      const ours = `${base}\nRun it with \`pnpm dev\` from the repository root.\n`;
      const baseOid = worktree.commits[0]?.oid;
      commitOnHead(worktree, {
        oid: newOid(),
        subject: 'Say how to run it in the README',
        author: 'Fabio Fiorita',
        files: [{ path, before: file.head, after: ours }],
      });
      file.head = ours;
      file.working = ours;
      worktree.incoming = {
        oid: newOid(),
        parentOids: baseOid == null ? [] : [baseOid],
        subject: 'Explain the board filters',
        author: 'Ana Souza',
        minutesAgo: 8,
        files: [
          {
            path,
            before: base,
            after: `${base}\nFilters live in the URL, so a filtered board can be shared.\n`,
          },
          // Merged cleanly: Git stages it while the README waits.
          {
            path: 'docs/board-filters.md',
            before: null,
            after:
              '# Board filters\n\nThe board reads `?tag=` and `?owner=` from the URL. An empty filter shows every task.\n',
          },
        ],
      };
      worktree.branch.ahead += 1;
      worktree.branch.behind = Math.max(worktree.branch.behind, 1);
      worktree.branch.upstreamOid = worktree.incoming.oid;
      store.emit({ kind: 'files', worktreeId, paths: [path] });
      store.emit({ kind: 'branch', worktreeId });
      return path;
    },

    /**
     * The agent resolves the conflict in its session and stages it. A merge then waits
     * for your commit; a rebase the agent continues itself.
     */
    agentResolvesConflict(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (worktree == null || worktree.inProgress == null) return null;
      const kind = worktree.inProgress;
      const paths: string[] = [];
      for (const [path, file] of worktree.files) {
        if (file.conflict == null || file.working == null) continue;
        file.working = file.working.replace(
          /<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g,
          '$1$2',
        );
        file.conflict = undefined;
        file.staged = true;
        paths.push(path);
      }
      const incoming = worktree.incoming;
      const local = worktree.commits[0];
      if (kind === 'rebase' && incoming != null && local != null) {
        // `git rebase --continue`: the local commit is replayed on the upstream one.
        const upstream = worktree.branch.upstream;
        for (const commit of worktree.commits)
          commit.refs = commit.refs?.filter((ref) => ref !== upstream);
        const replayed = local.files.map((entry) => ({
          ...entry,
          before:
            incoming.files.find((candidate) => candidate.path === entry.path)
              ?.after ?? entry.before,
          after: worktree.files.get(entry.path)?.working ?? entry.after,
        }));
        worktree.commits.splice(
          0,
          1,
          {
            ...local,
            oid: newOid(),
            parentOids: [incoming.oid],
            minutesAgo: 0,
            files: replayed,
          },
          { ...incoming, refs: upstream == null ? undefined : [upstream] },
        );
        for (const path of paths) {
          const file = worktree.files.get(path);
          if (file != null)
            Object.assign(file, { head: file.working, staged: undefined });
        }
        worktree.branch.behind = 0;
        worktree.branch.upstreamOid = incoming.oid;
        worktree.inProgress = null;
        worktree.incoming = null;
      }
      store.emit({ kind: 'files', worktreeId, paths });
      store.emit({ kind: 'branch', worktreeId });
      return kind;
    },

    /** `git merge --abort` or `git rebase --abort` in a terminal: back to before the pull, still behind. */
    abortInTerminal(worktreeId: string) {
      const worktree = worktreeOf(worktreeId);
      if (worktree == null || worktree.inProgress == null) return null;
      const kind = worktree.inProgress;
      const [conflicting, ...others] = worktree.incoming?.files ?? [];
      const paths: string[] = [];
      for (const [path, file] of worktree.files) {
        if (file.conflict == null && path !== conflicting?.path) continue;
        Object.assign(file, {
          working: file.head,
          conflict: undefined,
          staged: undefined,
        });
        paths.push(path);
      }
      // What the pull brought in cleanly goes too.
      for (const other of others) {
        if (other.before == null) worktree.files.delete(other.path);
        else
          worktree.files.set(other.path, {
            ...worktree.files.get(other.path),
            head: other.before,
            working: other.before,
            staged: undefined,
          });
        paths.push(other.path);
      }
      worktree.inProgress = null;
      store.emit({ kind: 'files', worktreeId, paths });
      store.emit({ kind: 'branch', worktreeId });
      return kind;
    },

    /** Whether the server has agent CLIs to draft commits with (Claude Code, Codex). */
    setAgentClis(installed: boolean) {
      store.scenario.agentClis = installed;
    },

    setSlowNetwork(slow: boolean) {
      store.scenario.latencyMs = slow ? 1400 : 220;
    },

    failNextRequest() {
      store.scenario.failNext = true;
    },
  };
}

export type MockControls = ReturnType<typeof createMockControls>;
