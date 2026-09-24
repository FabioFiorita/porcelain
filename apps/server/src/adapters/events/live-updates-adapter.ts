import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { type FSWatcher, watch as watchDirectory } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import * as parcelWatcher from '@parcel/watcher';
import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import { listIgnoredPaths } from '@porcelain/git/inspection';
import type {
  ListableProject,
  ListedWorktree,
} from '@porcelain/projects/models';
import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { EventPublisher } from '../../runtime/event-publisher.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

type ParcelWatcher = Pick<typeof parcelWatcher, 'subscribe'>;

type WorktreeChange = 'files' | 'git' | 'reviewed' | 'comments' | 'review';

export type LiveNotice =
  | { type: 'ready' }
  | { type: 'heartbeat' }
  | { type: 'inventory' }
  | {
      type: 'git-action';
      projectId: string;
      worktreeId: string;
      receipt: GitActionReceiptView;
    }
  | { type: 'project'; projectId: string; change: 'files' | 'preferences' }
  | {
      type: 'worktree';
      projectId: string;
      worktreeId: string;
      change: WorktreeChange;
    };

export type LiveSubscription = {
  projects: readonly string[];
  worktrees: readonly {
    projectId: string;
    worktreeId: string;
    paths: readonly string[];
  }[];
};

type Send = (notice: LiveNotice) => void;

export type LiveConnection = {
  subscribe(value: LiveSubscription): Promise<void>;
  close(): void;
};

export type LiveUpdatesLimits = {
  maxConnections: number;
  maxWatchedWorktrees: number;
  burstMs: number;
  heartbeatMs: number;
};

export type ChangedPathsListener = {
  execute(
    input: InvalidateReviewedMarksInput,
    context: OperationContext,
  ): Promise<void>;
};

type ClientState = {
  send: Send;
  projects: Set<string>;
  worktrees: Map<string, Set<string>>;
  closed: boolean;
  update: Promise<void>;
};

type WorktreeWatch = {
  projectId: string;
  worktreeId: string;
  root: string;
  commonDirectory: string;
  ignored: string[];
  clients: Map<ClientState, Set<string>>;
  subscription: parcelWatcher.AsyncSubscription | undefined;
  supplements: Map<string, FSWatcher>;
  pendingPaths: Set<string>;
  timer: NodeJS.Timeout | undefined;
};

type ProjectWatch = {
  commonDirectory: string;
  clients: Set<ClientState>;
  subscription: parcelWatcher.AsyncSubscription | undefined;
  timer: NodeJS.Timeout | undefined;
};

const withoutUnreadableStat = () => undefined;
const keepPreviousIgnoreRules = () => undefined;
const withoutProjectNotices = () => undefined;
const withoutWorktreeNotices = () => undefined;
const settledEitherWay = () => undefined;

function watchIfPossible(
  directory: string,
  listener: (event: string, filename: string | Buffer | null) => void,
): FSWatcher | undefined {
  try {
    return watchDirectory(directory, listener);
  } catch {
    return undefined;
  }
}

export class LiveUpdatesAdapter implements EventPublisher {
  private readonly worktrees: Pick<
    WorktreeAccess<ListedWorktree>,
    'forWriting'
  >;
  private readonly pathsChanged: ChangedPathsListener;
  private readonly watcher: ParcelWatcher;
  private readonly ignoredPaths: typeof listIgnoredPaths;
  private readonly projects: () => readonly ListableProject[];
  private readonly limits: LiveUpdatesLimits;
  private readonly clients = new Set<ClientState>();
  private readonly worktreeWatches = new Map<string, WorktreeWatch>();
  private readonly projectWatches = new Map<string, ProjectWatch>();
  private registryUpdate = Promise.resolve();
  private readonly pendingStops = new Set<Promise<void>>();
  private readonly heartbeat: NodeJS.Timeout;
  private closed = false;

  constructor(options: {
    worktrees: Pick<WorktreeAccess<ListedWorktree>, 'forWriting'>;
    pathsChanged: ChangedPathsListener;
    projects: () => readonly ListableProject[];
    limits: LiveUpdatesLimits;
    watcher?: ParcelWatcher;
    ignoredPaths?: typeof listIgnoredPaths;
  }) {
    this.worktrees = options.worktrees;
    this.pathsChanged = options.pathsChanged;
    this.watcher = options.watcher ?? parcelWatcher;
    this.ignoredPaths = options.ignoredPaths ?? listIgnoredPaths;
    this.projects = options.projects;
    this.limits = options.limits;
    this.heartbeat = setInterval(
      () => this.broadcast({ type: 'heartbeat' }),
      this.limits.heartbeatMs,
    );
    this.heartbeat.unref();
  }

  connect(send: Send): LiveConnection {
    if (this.closed || this.clients.size >= this.limits.maxConnections)
      throw new Error('Live update capacity reached');
    const state: ClientState = {
      send,
      projects: new Set(),
      worktrees: new Map(),
      closed: false,
      update: Promise.resolve(),
    };
    this.clients.add(state);
    send({ type: 'ready' });
    return {
      subscribe: (value) => {
        state.update = state.update.then(() =>
          this.updateRegistry(() => this.replace(state, value)),
        );
        return state.update;
      },
      close: () => this.disconnect(state),
    };
  }

  inventoryChanged(): void {
    this.broadcast({ type: 'inventory' });
  }

  projectChanged(projectId: string, change: 'preferences'): void {
    const watched = this.projectWatches.get(projectId);
    if (!watched) return;
    for (const client of watched.clients)
      client.send({ type: 'project', projectId, change });
  }

  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments',
  ): void {
    this.announceWorktree(worktreeId, change);
  }

  filesChanged(worktreeId: string, paths: readonly string[]): void {
    this.announcePathsChanged(worktreeId, paths, 'files');
  }

  gitActionChanged(receipt: GitActionReceiptView): void {
    const notice: LiveNotice = {
      type: 'git-action',
      projectId: receipt.projectId,
      worktreeId: receipt.worktreeId,
      receipt,
    };
    const recipients = new Set<ClientState>();
    for (const client of this.projectWatches.get(receipt.projectId)?.clients ??
      [])
      recipients.add(client);
    const worktree = this.worktreeWatches.get(receipt.worktreeId);
    if (worktree?.projectId === receipt.projectId)
      for (const client of worktree.clients.keys()) recipients.add(client);
    for (const client of recipients) client.send(notice);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    for (const client of this.clients) {
      client.closed = true;
      client.worktrees.clear();
      client.projects.clear();
    }
    this.clients.clear();
    await this.registryUpdate;
    const worktrees = [...this.worktreeWatches.values()];
    const projects = [...this.projectWatches.values()];
    this.worktreeWatches.clear();
    this.projectWatches.clear();
    await Promise.allSettled([
      ...worktrees.map((entry) => this.stopWorktree(entry)),
      ...projects.map((entry) => this.stopProject(entry)),
      ...this.pendingStops,
    ]);
  }

  private broadcast(notice: LiveNotice): void {
    for (const client of this.clients) client.send(notice);
  }

  private announceWorktree(worktreeId: string, change: WorktreeChange): void {
    const watched = this.worktreeWatches.get(worktreeId);
    if (!watched) return;
    const notice: LiveNotice = {
      type: 'worktree',
      projectId: watched.projectId,
      worktreeId,
      change,
    };
    for (const client of watched.clients.keys()) client.send(notice);
  }

  private announcePathsChanged(
    worktreeId: string,
    paths: readonly string[] | undefined,
    change: 'files' | 'git',
  ): void {
    const announce = () => this.announceWorktree(worktreeId, change);
    void this.pathsChanged
      .execute({ worktreeId, paths }, {})
      .then(announce, announce);
  }

  private async replace(
    client: ClientState,
    subscription: LiveSubscription,
  ): Promise<void> {
    if (client.closed || this.closed) return;
    const wanted = new Map(
      subscription.worktrees.map((entry) => [
        entry.worktreeId,
        { projectId: entry.projectId, paths: new Set(entry.paths) },
      ]),
    );
    const wantedProjects = new Set([
      ...subscription.projects,
      ...[...wanted.values()].map((entry) => entry.projectId),
    ]);
    for (const projectId of [...client.projects])
      if (!wantedProjects.has(projectId))
        this.removeProjectClient(client, projectId);
    for (const projectId of wantedProjects) {
      if (client.projects.has(projectId)) continue;
      const project = this.projects().find((entry) => entry.id === projectId);
      if (project)
        await this.addProjectClient(
          client,
          project.id,
          project.commonDirectory,
        ).catch(withoutProjectNotices);
    }
    for (const worktreeId of client.worktrees.keys())
      if (!wanted.has(worktreeId)) this.removeClient(client, worktreeId);
    for (const [worktreeId, request] of wanted) {
      if (client.closed) return;
      const current = this.worktreeWatches.get(worktreeId);
      if (current) {
        if (current.projectId !== request.projectId) continue;
        current.clients.set(client, request.paths);
        client.worktrees.set(worktreeId, request.paths);
        await this.refreshSupplements(current);
        continue;
      }
      if (this.worktreeWatches.size >= this.limits.maxWatchedWorktrees)
        continue;
      const entry = await this.watchWorktree(
        request.projectId,
        worktreeId,
      ).catch(withoutWorktreeNotices);
      if (!entry) continue;
      if (client.closed || this.closed) {
        await this.stopWorktree(entry);
        return;
      }
      entry.clients.set(client, request.paths);
      client.worktrees.set(worktreeId, request.paths);
      this.worktreeWatches.set(worktreeId, entry);
      await this.refreshSupplements(entry);
    }
  }

  private async watchWorktree(
    projectId: string,
    worktreeId: string,
  ): Promise<WorktreeWatch | undefined> {
    const check = await this.worktrees.forWriting(worktreeId);
    if (check.kind !== 'found' || check.worktree.projectId !== projectId)
      return undefined;
    const resolved = check.worktree;
    const entry: WorktreeWatch = {
      projectId: resolved.projectId,
      worktreeId: resolved.id,
      root: resolved.path,
      commonDirectory: resolved.commonDirectory,
      ignored: await this.ignoredPaths(resolved.path),
      clients: new Map(),
      subscription: undefined,
      supplements: new Map(),
      pendingPaths: new Set(),
      timer: undefined,
    };
    entry.subscription = await this.subscribeWorktree(entry, entry.ignored);
    return entry;
  }

  private subscribeWorktree(
    entry: WorktreeWatch,
    ignored: readonly string[],
  ): Promise<parcelWatcher.AsyncSubscription> {
    return this.watcher.subscribe(
      entry.root,
      (error, events) => {
        if (error) return this.queueFiles(entry, []);
        this.queueFiles(
          entry,
          events.flatMap((event) => {
            const path = relative(entry.root, event.path);
            return path === '' || path.startsWith(`..${sep}`) || path === '..'
              ? []
              : [path.split(sep).join('/')];
          }),
        );
      },
      {
        ...(process.platform === 'linux'
          ? { backend: 'inotify' as const }
          : {}),
        ignore: [
          join(entry.root, '.git'),
          ...ignored.map((path) => join(entry.root, path)),
        ],
      },
    );
  }

  private async addProjectClient(
    client: ClientState,
    projectId: string,
    commonDirectory: string,
  ): Promise<void> {
    let project = this.projectWatches.get(projectId);
    if (!project) {
      const entry: ProjectWatch = {
        commonDirectory,
        clients: new Set<ClientState>(),
        subscription: undefined,
        timer: undefined,
      };
      entry.subscription = await this.watcher.subscribe(
        entry.commonDirectory,
        (error, events) => {
          if (!error && events.length > 0) this.queueGit(projectId, entry);
        },
        {
          ...(process.platform === 'linux'
            ? { backend: 'inotify' as const }
            : {}),
          ignore: [
            join(entry.commonDirectory, 'objects'),
            join(entry.commonDirectory, 'lfs', 'objects'),
            join(entry.commonDirectory, 'hooks'),
          ],
        },
      );
      if (client.closed || this.closed) {
        await entry.subscription.unsubscribe();
        return;
      }
      project = entry;
      this.projectWatches.set(projectId, project);
    }
    project.clients.add(client);
    client.projects.add(projectId);
  }

  private queueFiles(entry: WorktreeWatch, paths: readonly string[]): void {
    for (const path of paths) entry.pendingPaths.add(path);
    if (entry.timer) return;
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      const changed = [...entry.pendingPaths];
      entry.pendingPaths.clear();
      this.announcePathsChanged(
        entry.worktreeId,
        changed.length ? changed : undefined,
        'files',
      );
      if (
        changed.some(
          (path) => path === '.gitignore' || path.endsWith('/.gitignore'),
        )
      )
        void this.updateRegistry(() => this.refreshIgnoreRules(entry)).catch(
          keepPreviousIgnoreRules,
        );
    }, this.limits.burstMs);
    entry.timer.unref();
  }

  private queueGit(projectId: string, entry: ProjectWatch): void {
    if (entry.timer) return;
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      for (const watched of this.worktreeWatches.values())
        if (watched.projectId === projectId)
          this.announcePathsChanged(watched.worktreeId, undefined, 'git');
      this.broadcast({ type: 'inventory' });
      void this.updateRegistry(async () => {
        for (const watched of this.worktreeWatches.values())
          if (watched.projectId === projectId)
            await this.refreshIgnoreRules(watched);
      }).catch(keepPreviousIgnoreRules);
    }, this.limits.burstMs);
    entry.timer.unref();
  }

  private async refreshSupplements(entry: WorktreeWatch): Promise<void> {
    const explicit = new Set(
      [...entry.clients.values()].flatMap((paths) => [...paths]),
    );
    const ignored = [...explicit].filter((path) =>
      entry.ignored.some(
        (root) => path === root || path.startsWith(`${root}/`),
      ),
    );
    const directories = new Set<string>();
    for (const path of ignored) {
      const absolute = resolve(entry.root, path);
      if (
        absolute !== entry.root &&
        !absolute.startsWith(`${resolve(entry.root)}${sep}`)
      )
        continue;
      const info = await stat(absolute).catch(withoutUnreadableStat);
      directories.add(info?.isDirectory() ? absolute : dirname(absolute));
    }
    for (const [directory, watcher] of entry.supplements) {
      if (directories.has(directory)) continue;
      watcher.close();
      entry.supplements.delete(directory);
    }
    for (const directory of directories)
      if (!entry.supplements.has(directory))
        this.superviseDirectory(entry, directory);
  }

  private superviseDirectory(entry: WorktreeWatch, directory: string): void {
    const watcher = watchIfPossible(directory, (event, filename) => {
      if (event !== 'change' && event !== 'rename') return;
      const absolute = filename
        ? join(directory, filename.toString())
        : directory;
      const path = relative(entry.root, absolute).split(sep).join('/');
      this.queueFiles(entry, [path]);
    });
    if (!watcher) return;
    watcher.on('error', () => {
      watcher.close();
      entry.supplements.delete(directory);
    });
    entry.supplements.set(directory, watcher);
  }

  private async refreshIgnoreRules(entry: WorktreeWatch): Promise<void> {
    if (this.worktreeWatches.get(entry.worktreeId) !== entry) return;
    const ignored = await this.ignoredPaths(entry.root);
    if (
      ignored.length === entry.ignored.length &&
      ignored.every((path, index) => path === entry.ignored[index])
    )
      return;
    await entry.subscription?.unsubscribe();
    let subscription: parcelWatcher.AsyncSubscription;
    try {
      subscription = await this.subscribeWorktree(entry, ignored);
    } catch (error) {
      const restored = await this.subscribeWorktree(entry, entry.ignored);
      if (
        this.closed ||
        this.worktreeWatches.get(entry.worktreeId) !== entry ||
        entry.clients.size === 0
      ) {
        await restored.unsubscribe();
      } else {
        entry.subscription = restored;
        this.queueFiles(entry, []);
      }
      throw error;
    }
    if (
      this.closed ||
      this.worktreeWatches.get(entry.worktreeId) !== entry ||
      entry.clients.size === 0
    ) {
      await subscription.unsubscribe();
      return;
    }
    entry.subscription = subscription;
    entry.ignored = [...ignored];
    await this.refreshSupplements(entry);
    this.queueFiles(entry, []);
  }

  private removeClient(client: ClientState, worktreeId: string): void {
    client.worktrees.delete(worktreeId);
    const entry = this.worktreeWatches.get(worktreeId);
    if (!entry) return;
    entry.clients.delete(client);
    if (entry.clients.size > 0) {
      void this.refreshSupplements(entry);
    } else {
      this.worktreeWatches.delete(worktreeId);
      this.trackStop(this.stopWorktree(entry));
    }
  }

  private removeProjectClient(client: ClientState, projectId: string): void {
    client.projects.delete(projectId);
    const project = this.projectWatches.get(projectId);
    if (!project) return;
    project.clients.delete(client);
    if (project.clients.size > 0) return;
    this.projectWatches.delete(projectId);
    this.trackStop(this.stopProject(project));
  }

  private disconnect(client: ClientState): void {
    if (client.closed) return;
    client.closed = true;
    this.clients.delete(client);
    for (const worktreeId of [...client.worktrees.keys()])
      this.removeClient(client, worktreeId);
    for (const projectId of [...client.projects])
      this.removeProjectClient(client, projectId);
  }

  private async stopWorktree(entry: WorktreeWatch): Promise<void> {
    if (entry.timer) clearTimeout(entry.timer);
    for (const watcher of entry.supplements.values()) watcher.close();
    entry.supplements.clear();
    await entry.subscription?.unsubscribe();
  }

  private async stopProject(entry: ProjectWatch): Promise<void> {
    if (entry.timer) clearTimeout(entry.timer);
    await entry.subscription?.unsubscribe();
  }

  private trackStop(stop: Promise<void>): void {
    const settled = stop.catch(settledEitherWay);
    this.pendingStops.add(settled);
    void settled.then(() => this.pendingStops.delete(settled));
  }

  private updateRegistry(update: () => Promise<void>): Promise<void> {
    const result = this.registryUpdate.then(update);
    this.registryUpdate = result.catch(settledEitherWay);
    return result;
  }
}
