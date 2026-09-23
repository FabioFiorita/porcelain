import { type FSWatcher, watch as watchDirectory } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import * as parcelWatcher from '@parcel/watcher';
import type { LiveNotice, LiveSubscription } from '@porcelain/contracts/access';
import { listIgnoredPaths } from '@porcelain/git/inspection';
import type {
  ListableProject,
  Worktree as ResolvedWorktree,
} from '@porcelain/projects/models';
import type { ReviewedFileStore } from '@porcelain/reviews/ports';

const BURST_MS = 150;
const HEARTBEAT_MS = 25_000;
const MAX_CONNECTIONS = 64;
const MAX_WATCHED_WORKTREES = 64;

type ParcelWatcher = Pick<typeof parcelWatcher, 'subscribe'>;
type Send = (notice: LiveNotice) => void;

export type LiveConnection = {
  subscribe(value: LiveSubscription): Promise<void>;
  close(): void;
};

type WorktreeResolver = {
  inProject(
    projectId: string,
    worktreeId: string,
  ): Promise<
    Pick<ResolvedWorktree, 'projectId' | 'id' | 'path' | 'commonDirectory'>
  >;
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
  subscription: parcelWatcher.AsyncSubscription;
  supplements: Map<string, FSWatcher>;
  pendingPaths: Set<string>;
  timer?: NodeJS.Timeout;
};

type ProjectWatch = {
  commonDirectory: string;
  clients: Set<ClientState>;
  subscription: parcelWatcher.AsyncSubscription;
  timer?: NodeJS.Timeout;
};

export class LiveUpdates {
  private readonly worktrees: WorktreeResolver;
  private readonly reviewed: ReviewedFileStore;
  private readonly reviewedLayers:
    | {
        invalidate(worktreeId: string, paths?: readonly string[]): void;
      }
    | undefined;
  private readonly watcher: ParcelWatcher;
  private readonly ignoredPaths: typeof listIgnoredPaths;
  private readonly projects: () => readonly ListableProject[];
  private readonly clients = new Set<ClientState>();
  private readonly worktreeWatches = new Map<string, WorktreeWatch>();
  private readonly projectWatches = new Map<string, ProjectWatch>();
  private registryUpdate = Promise.resolve();
  private readonly pendingStops = new Set<Promise<void>>();
  private readonly heartbeat: NodeJS.Timeout;
  private closed = false;

  constructor(options: {
    worktrees: WorktreeResolver;
    reviewed: ReviewedFileStore;
    reviewedLayers?: {
      invalidate(worktreeId: string, paths?: readonly string[]): void;
    };
    watcher?: ParcelWatcher;
    ignoredPaths?: typeof listIgnoredPaths;
    projects: () => readonly ListableProject[];
  }) {
    this.worktrees = options.worktrees;
    this.reviewed = options.reviewed;
    this.reviewedLayers = options.reviewedLayers;
    this.watcher = options.watcher ?? parcelWatcher;
    this.ignoredPaths = options.ignoredPaths ?? listIgnoredPaths;
    this.projects = options.projects;
    this.heartbeat = setInterval(
      () => this.publish({ type: 'heartbeat' }),
      HEARTBEAT_MS,
    );
    this.heartbeat.unref();
  }

  connect(send: Send): LiveConnection {
    if (this.closed || this.clients.size >= MAX_CONNECTIONS)
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

  publish(notice: LiveNotice): void {
    if (notice.type === 'git-action') {
      const recipients = new Set<ClientState>();
      const project = this.projectWatches.get(notice.projectId);
      for (const client of project?.clients ?? []) recipients.add(client);
      const worktree = this.worktreeWatches.get(notice.worktreeId);
      if (worktree?.projectId === notice.projectId)
        for (const client of worktree.clients.keys()) recipients.add(client);
      for (const client of recipients) client.send(notice);
      return;
    }
    if (notice.type === 'worktree') {
      const watched = this.worktreeWatches.get(notice.worktreeId);
      if (!watched || watched.projectId !== notice.projectId) return;
      for (const client of watched.clients.keys()) client.send(notice);
      return;
    }
    if (notice.type === 'project') {
      const watched = this.projectWatches.get(notice.projectId);
      if (!watched) return;
      for (const client of watched.clients) client.send(notice);
      return;
    }
    for (const client of this.clients) client.send(notice);
  }

  publishWorktree(
    worktreeId: string,
    change: Extract<LiveNotice, { type: 'worktree' }>['change'],
  ): void {
    const watched = this.worktreeWatches.get(worktreeId);
    if (!watched) return;
    this.publish({
      type: 'worktree',
      projectId: watched.projectId,
      worktreeId,
      change,
    });
  }

  noteFiles(worktreeId: string, paths?: readonly string[]): void {
    const watched = this.worktreeWatches.get(worktreeId);
    if (!watched) return;
    this.reviewed.invalidate(worktreeId, paths);
    this.reviewedLayers?.invalidate(worktreeId, paths);
    this.publishWorktree(worktreeId, 'files');
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
      if (project) {
        try {
          await this.addProjectClient(
            client,
            project.id,
            project.commonDirectory,
          );
        } catch {}
      }
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
      if (this.worktreeWatches.size >= MAX_WATCHED_WORKTREES) continue;
      let entry: WorktreeWatch;
      try {
        const resolved = await this.worktrees.inProject(
          request.projectId,
          worktreeId,
        );
        const ignored = await this.ignoredPaths(resolved.path);
        entry = await this.startWorktree({
          projectId: resolved.projectId,
          worktreeId: resolved.id,
          root: resolved.path,
          commonDirectory: resolved.commonDirectory,
          ignored,
        });
      } catch {
        continue;
      }
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

  private async startWorktree(input: {
    projectId: string;
    worktreeId: string;
    root: string;
    commonDirectory: string;
    ignored: string[];
  }): Promise<WorktreeWatch> {
    const entry = {
      ...input,
      clients: new Map(),
      supplements: new Map(),
      pendingPaths: new Set(),
    } as WorktreeWatch;
    entry.subscription = await this.subscribeWorktree(entry, input.ignored);
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
      const entry = {
        commonDirectory,
        clients: new Set<ClientState>(),
      } as ProjectWatch;
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
      delete entry.timer;
      const changed = [...entry.pendingPaths];
      entry.pendingPaths.clear();
      this.reviewed.invalidate(
        entry.worktreeId,
        changed.length ? changed : undefined,
      );
      this.reviewedLayers?.invalidate(
        entry.worktreeId,
        changed.length ? changed : undefined,
      );
      this.publish({
        type: 'worktree',
        projectId: entry.projectId,
        worktreeId: entry.worktreeId,
        change: 'files',
      });
      if (
        changed.some(
          (path) => path === '.gitignore' || path.endsWith('/.gitignore'),
        )
      )
        void this.updateRegistry(() => this.refreshIgnoreRules(entry)).catch(
          () => undefined,
        );
    }, BURST_MS);
    entry.timer.unref();
  }

  private queueGit(projectId: string, entry: ProjectWatch): void {
    if (entry.timer) return;
    entry.timer = setTimeout(() => {
      delete entry.timer;
      for (const watched of this.worktreeWatches.values()) {
        if (watched.projectId !== projectId) continue;
        this.reviewed.invalidate(watched.worktreeId);
        this.reviewedLayers?.invalidate(watched.worktreeId);
        this.publish({
          type: 'worktree',
          projectId,
          worktreeId: watched.worktreeId,
          change: 'git',
        });
      }
      this.publish({ type: 'inventory' });
      void this.updateRegistry(async () => {
        for (const watched of this.worktreeWatches.values())
          if (watched.projectId === projectId)
            await this.refreshIgnoreRules(watched);
      }).catch(() => undefined);
    }, BURST_MS);
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
      const info = await stat(absolute).catch(() => null);
      directories.add(info?.isDirectory() ? absolute : dirname(absolute));
    }
    for (const [directory, watcher] of entry.supplements) {
      if (directories.has(directory)) continue;
      watcher.close();
      entry.supplements.delete(directory);
    }
    for (const directory of directories) {
      if (entry.supplements.has(directory)) continue;
      try {
        const watcher = watchDirectory(directory, (event, filename) => {
          if (event !== 'change' && event !== 'rename') return;
          const absolute = filename
            ? join(directory, filename.toString())
            : directory;
          const path = relative(entry.root, absolute).split(sep).join('/');
          this.queueFiles(entry, [path]);
        });
        watcher.on('error', () => {
          watcher.close();
          entry.supplements.delete(directory);
        });
        entry.supplements.set(directory, watcher);
      } catch {}
    }
  }

  private async refreshIgnoreRules(entry: WorktreeWatch): Promise<void> {
    if (this.worktreeWatches.get(entry.worktreeId) !== entry) return;
    const ignored = await this.ignoredPaths(entry.root);
    if (
      ignored.length === entry.ignored.length &&
      ignored.every((path, index) => path === entry.ignored[index])
    )
      return;
    await entry.subscription.unsubscribe();
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
    await entry.subscription.unsubscribe();
  }

  private async stopProject(entry: ProjectWatch): Promise<void> {
    if (entry.timer) clearTimeout(entry.timer);
    await entry.subscription.unsubscribe();
  }

  private trackStop(stop: Promise<void>): void {
    const settled = stop.catch(() => undefined);
    this.pendingStops.add(settled);
    void settled.then(() => this.pendingStops.delete(settled));
  }

  private updateRegistry(update: () => Promise<void>): Promise<void> {
    const result = this.registryUpdate.then(update);
    this.registryUpdate = result.catch(() => undefined);
    return result;
  }
}
