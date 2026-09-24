import type { EventPublisher } from '../ports/event-publisher.ts';
import type {
  FollowedTargets,
  WatchRequest,
} from '../ports/followed-targets.ts';
import type {
  FileWatch,
  IgnoreRulesRefresh,
  RepositoryWatch,
  WatchedProject,
  WatchedWorktree,
  WorktreeWatcher,
} from '../ports/worktree-watcher.ts';
import type { InvalidateReviewedMarksUseCase } from '../use-cases/reviews/invalidate-reviewed-marks.ts';
import { LiveUpdateCapacityError } from './errors/live-update-capacity-error.ts';
import type { Job } from './job.ts';

export type WatchWorktreesOptions = {
  maxConnections: number;
  maxWatchedWorktrees: number;
  burstMs: number;
};

export type WatchDemand = {
  replace(request: WatchRequest): Promise<FollowedTargets>;
  close(): void;
};

type Demand = {
  projects: Set<string>;
  worktrees: Map<string, ReadonlySet<string>>;
  closed: boolean;
  update: Promise<unknown>;
};

type WorktreeEntry = {
  worktree: WatchedWorktree;
  watch: FileWatch | undefined;
  demands: Map<Demand, ReadonlySet<string>>;
  pendingPaths: Set<string>;
  timer: NodeJS.Timeout | undefined;
};

type ProjectEntry = {
  project: WatchedProject;
  watch: RepositoryWatch | undefined;
  demands: Set<Demand>;
  timer: NodeJS.Timeout | undefined;
};

const settledEitherWay = () => undefined;

function changesIgnoreRules(path: string): boolean {
  return path === '.gitignore' || path.endsWith('/.gitignore');
}

export class WatchWorktreesJob implements Job {
  private readonly invalidateReviewedMarks: Pick<
    InvalidateReviewedMarksUseCase,
    'execute'
  >;
  private readonly events: EventPublisher;
  private readonly watcher: WorktreeWatcher;
  private readonly options: WatchWorktreesOptions;
  private readonly demands = new Set<Demand>();
  private readonly worktrees = new Map<string, WorktreeEntry>();
  private readonly projects = new Map<string, ProjectEntry>();
  private readonly pendingStops = new Set<Promise<void>>();
  private registryUpdate: Promise<void> = Promise.resolve();
  private stopped = true;

  constructor(
    invalidateReviewedMarks: Pick<InvalidateReviewedMarksUseCase, 'execute'>,
    events: EventPublisher,
    watcher: WorktreeWatcher,
    options: WatchWorktreesOptions,
  ) {
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.events = events;
    this.watcher = watcher;
    this.options = options;
  }

  start(): void {
    this.stopped = false;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const demand of this.demands) {
      demand.closed = true;
      demand.worktrees.clear();
      demand.projects.clear();
    }
    this.demands.clear();
    await this.registryUpdate;
    const worktrees = [...this.worktrees.values()];
    const projects = [...this.projects.values()];
    this.worktrees.clear();
    this.projects.clear();
    await Promise.allSettled([
      ...worktrees.map((entry) => this.stopWorktree(entry)),
      ...projects.map((entry) => this.stopProject(entry)),
      ...this.pendingStops,
    ]);
  }

  open(): WatchDemand {
    if (this.stopped || this.demands.size >= this.options.maxConnections)
      throw new LiveUpdateCapacityError();
    const demand: Demand = {
      projects: new Set(),
      worktrees: new Map(),
      closed: false,
      update: Promise.resolve(),
    };
    this.demands.add(demand);
    return {
      replace: (request) => {
        const update = demand.update.then(() =>
          this.updateRegistry(() => this.replace(demand, request)),
        );
        demand.update = update.catch(settledEitherWay);
        return update;
      },
      close: () => this.close(demand),
    };
  }

  private async replace(
    demand: Demand,
    request: WatchRequest,
  ): Promise<FollowedTargets> {
    if (demand.closed || this.stopped) return this.followed(demand);
    const wanted = new Map(
      request.worktrees.map((entry) => [
        entry.worktreeId,
        { projectId: entry.projectId, paths: new Set(entry.paths) },
      ]),
    );
    const wantedProjects = new Set([
      ...request.projects,
      ...[...wanted.values()].map((entry) => entry.projectId),
    ]);
    for (const projectId of [...demand.projects])
      if (!wantedProjects.has(projectId))
        this.removeProjectDemand(demand, projectId);
    for (const projectId of wantedProjects) {
      if (demand.projects.has(projectId)) continue;
      const project = this.watcher.findProject(projectId);
      if (project)
        await this.addProjectDemand(demand, project).catch((error: unknown) =>
          this.reportFailure(error),
        );
    }
    for (const worktreeId of [...demand.worktrees.keys()])
      if (!wanted.has(worktreeId))
        this.removeWorktreeDemand(demand, worktreeId);
    for (const [worktreeId, wish] of wanted) {
      if (demand.closed) return this.followed(demand);
      const current = this.worktrees.get(worktreeId);
      if (current) {
        if (current.worktree.projectId !== wish.projectId) continue;
        current.demands.set(demand, wish.paths);
        demand.worktrees.set(worktreeId, wish.paths);
        await current.watch?.follow(this.followedPaths(current));
        continue;
      }
      if (this.worktrees.size >= this.options.maxWatchedWorktrees) continue;
      const entry = await this.watchWorktree(wish.projectId, worktreeId).catch(
        (error: unknown) => this.reportFailure(error),
      );
      if (!entry) continue;
      if (demand.closed || this.stopped) {
        await this.stopWorktree(entry);
        return this.followed(demand);
      }
      entry.demands.set(demand, wish.paths);
      demand.worktrees.set(worktreeId, wish.paths);
      this.worktrees.set(worktreeId, entry);
      await entry.watch?.follow(this.followedPaths(entry));
    }
    return this.followed(demand);
  }

  private followed(demand: Demand): FollowedTargets {
    return {
      projects: [...demand.projects],
      worktrees: [...demand.worktrees.keys()].flatMap((worktreeId) => {
        const entry = this.worktrees.get(worktreeId);
        return entry
          ? [{ projectId: entry.worktree.projectId, worktreeId }]
          : [];
      }),
    };
  }

  private followedPaths(entry: WorktreeEntry): string[] {
    return [
      ...new Set([...entry.demands.values()].flatMap((paths) => [...paths])),
    ];
  }

  private async watchWorktree(
    projectId: string,
    worktreeId: string,
  ): Promise<WorktreeEntry | undefined> {
    const worktree = await this.watcher.findWorktree(worktreeId);
    if (!worktree || worktree.projectId !== projectId) return undefined;
    const entry: WorktreeEntry = {
      worktree,
      watch: undefined,
      demands: new Map(),
      pendingPaths: new Set(),
      timer: undefined,
    };
    entry.watch = await this.watcher.watchFiles(worktree, (paths) =>
      this.queueFiles(entry, paths),
    );
    return entry;
  }

  private async addProjectDemand(
    demand: Demand,
    project: WatchedProject,
  ): Promise<void> {
    const existing = this.projects.get(project.projectId);
    if (existing) {
      existing.demands.add(demand);
      demand.projects.add(project.projectId);
      return;
    }
    const entry: ProjectEntry = {
      project,
      watch: undefined,
      demands: new Set(),
      timer: undefined,
    };
    entry.watch = await this.watcher.watchRepository(project, () =>
      this.queueRepository(entry),
    );
    if (demand.closed || this.stopped) {
      await this.stopProject(entry);
      return;
    }
    entry.demands.add(demand);
    demand.projects.add(project.projectId);
    this.projects.set(project.projectId, entry);
  }

  private queueFiles(entry: WorktreeEntry, paths: readonly string[]): void {
    for (const path of paths) entry.pendingPaths.add(path);
    if (entry.timer) return;
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      const changed = [...entry.pendingPaths];
      entry.pendingPaths.clear();
      const { worktreeId } = entry.worktree;
      this.pathsChanged(worktreeId, changed, () =>
        this.events.filesChanged(worktreeId, changed),
      );
      if (changed.some(changesIgnoreRules)) this.queueIgnoreRules([entry]);
    }, this.options.burstMs);
    entry.timer.unref();
  }

  private queueRepository(entry: ProjectEntry): void {
    if (entry.timer) return;
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      const watched = [...this.worktrees.values()].filter(
        (worktree) => worktree.worktree.projectId === entry.project.projectId,
      );
      for (const worktree of watched) {
        const { worktreeId } = worktree.worktree;
        this.pathsChanged(worktreeId, [], () =>
          this.events.worktreeChanged(worktreeId, 'git'),
        );
      }
      this.events.inventoryChanged();
      this.queueIgnoreRules(watched);
    }, this.options.burstMs);
    entry.timer.unref();
  }

  private pathsChanged(
    worktreeId: string,
    paths: readonly string[],
    announce: () => void,
  ): void {
    this.invalidateReviewedMarks
      .execute({ worktreeId, paths: paths.length > 0 ? paths : undefined }, {})
      .then(announce, (error: unknown) => {
        this.reportFailure(error);
        announce();
      });
  }

  private queueIgnoreRules(entries: readonly WorktreeEntry[]): void {
    this.updateRegistry(async () => {
      for (const entry of entries) await this.refreshIgnoreRules(entry);
    }).catch((error: unknown) => this.reportFailure(error));
  }

  private async refreshIgnoreRules(entry: WorktreeEntry): Promise<void> {
    if (this.worktrees.get(entry.worktree.worktreeId) !== entry) return;
    const refreshed = await entry.watch
      ?.refreshIgnoreRules()
      .catch((error: unknown): IgnoreRulesRefresh => {
        this.reportFailure(error);
        return 'changed';
      });
    if (
      refreshed === 'changed' &&
      this.worktrees.get(entry.worktree.worktreeId) === entry
    )
      this.queueFiles(entry, []);
  }

  private removeWorktreeDemand(demand: Demand, worktreeId: string): void {
    demand.worktrees.delete(worktreeId);
    const entry = this.worktrees.get(worktreeId);
    if (!entry) return;
    entry.demands.delete(demand);
    if (entry.demands.size > 0) {
      entry.watch
        ?.follow(this.followedPaths(entry))
        .catch((error: unknown) => this.reportFailure(error));
      return;
    }
    this.worktrees.delete(worktreeId);
    this.trackStop(this.stopWorktree(entry));
  }

  private removeProjectDemand(demand: Demand, projectId: string): void {
    demand.projects.delete(projectId);
    const entry = this.projects.get(projectId);
    if (!entry) return;
    entry.demands.delete(demand);
    if (entry.demands.size > 0) return;
    this.projects.delete(projectId);
    this.trackStop(this.stopProject(entry));
  }

  private close(demand: Demand): void {
    if (demand.closed) return;
    demand.closed = true;
    this.demands.delete(demand);
    for (const worktreeId of [...demand.worktrees.keys()])
      this.removeWorktreeDemand(demand, worktreeId);
    for (const projectId of [...demand.projects])
      this.removeProjectDemand(demand, projectId);
  }

  private async stopWorktree(entry: WorktreeEntry): Promise<void> {
    if (entry.timer) clearTimeout(entry.timer);
    await entry.watch?.close();
  }

  private async stopProject(entry: ProjectEntry): Promise<void> {
    if (entry.timer) clearTimeout(entry.timer);
    await entry.watch?.close();
  }

  private trackStop(stop: Promise<void>): void {
    const settled = stop.catch((error: unknown) => this.reportFailure(error));
    this.pendingStops.add(settled);
    settled.then(() => this.pendingStops.delete(settled), settledEitherWay);
  }

  private updateRegistry<T>(update: () => Promise<T>): Promise<T> {
    const result = this.registryUpdate.then(update);
    this.registryUpdate = result.then(settledEitherWay, settledEitherWay);
    return result;
  }

  private reportFailure(error: unknown): undefined {
    this.events.jobFailed('watch-worktrees', error);
    return undefined;
  }
}
