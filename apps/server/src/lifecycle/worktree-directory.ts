import { dirname } from 'node:path';
import type { DiscoveryResult } from '@porcelain/git/dtos/discovery-result';
import { isRepositoryUnavailable } from '@porcelain/git/errors/is-repository-unavailable';
import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import {
  corroborates,
  identity,
  readGitdirPointer,
  readHead,
} from '@porcelain/git/worktree-registry';
import type {
  ListableProject,
  ProjectListing,
  ResolvedWorktree,
} from '../models/worktree.ts';
import { deriveWorktreeId } from '../models/worktree-id.ts';
import type { WorktreeSource } from '../repositories/interfaces/worktree-source.ts';
import { ProjectListingTimeoutError } from './errors/project-listing-timeout-error.ts';
import type { LaunchLimit } from './launch-limit.ts';
import type { SharedReads } from './shared-reads.ts';

const TIMED_OUT = new ProjectListingTimeoutError();

export class WorktreeDirectory implements WorktreeSource {
  private readonly entries = new Map<string, ResolvedWorktree>();
  private readonly git: GitFactory;
  private readonly reads: SharedReads;
  private readonly launches: LaunchLimit;
  private readonly timeoutMs: number;
  private readonly projects: () => readonly ListableProject[];

  constructor(options: {
    git: GitFactory;
    reads: SharedReads;
    launches: LaunchLimit;
    timeoutMs: number;
    projects: () => readonly ListableProject[];
  }) {
    this.git = options.git;
    this.reads = options.reads;
    this.launches = options.launches;
    this.timeoutMs = options.timeoutMs;
    this.projects = options.projects;
  }

  async list(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<ProjectListing> {
    return this.reads.run(
      `worktrees\0${project.id}\0${project.commonDirectory}`,
      async (shared) => this.listNow(project, shared),
      signal,
    );
  }

  async listAll(signal?: AbortSignal): Promise<ProjectListing[]> {
    return Promise.all(
      this.projects().map((project) => this.list(project, signal)),
    );
  }

  async resolve(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedWorktree | null> {
    const known = this.entries.get(worktreeId);
    const refreshed = known ? await this.reread(known) : null;
    if (refreshed) return refreshed;
    if (known) this.entries.delete(worktreeId);
    const listings = await this.listAll(signal);
    const found = this.entries.get(worktreeId);
    if (found) return this.reread(found);
    if (listings.some((listing) => listing.failure !== undefined))
      throw new RepositoryIdentityMismatchError();
    return null;
  }

  repositoryOf(worktreeId: string): string | null {
    return this.entries.get(worktreeId)?.repositoryIdentity ?? null;
  }

  forget(projectId: string) {
    for (const [id, entry] of this.entries)
      if (entry.projectId === projectId) this.entries.delete(id);
  }

  private async listNow(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<ProjectListing> {
    let discovered: DiscoveryResult;
    let expiry: AbortSignal | undefined;
    try {
      discovered = await this.launches.run(() => {
        expiry = AbortSignal.timeout(this.timeoutMs);
        const listing = signal ? AbortSignal.any([signal, expiry]) : expiry;
        return this.git(project.commonDirectory).listWorktrees(listing, {
          commonDirectory: project.commonDirectory,
        });
      }, signal);
    } catch (failure) {
      signal?.throwIfAborted();
      if (expiry?.aborted)
        return {
          projectId: project.id,
          worktrees: this.known(project.id),
          issues: [
            { path: dirname(project.commonDirectory), error: TIMED_OUT },
          ],
          failure: TIMED_OUT,
          complete: false,
        };
      if (!isRepositoryUnavailable(failure)) throw failure;
      return {
        projectId: project.id,
        worktrees: this.known(project.id),
        issues: [],
        failure,
        complete: false,
      };
    }
    if (
      discovered.repository.repositoryIdentity !== project.repositoryIdentity
    ) {
      const failure = new RepositoryIdentityMismatchError();
      return {
        projectId: project.id,
        worktrees: this.known(project.id),
        issues: [{ path: dirname(project.commonDirectory), error: failure }],
        failure,
        complete: false,
      };
    }
    const worktrees: ResolvedWorktree[] = [];
    let complete = true;
    for (const worktree of discovered.repository.worktrees) {
      if (!worktree.metadataIdentity) {
        complete = false;
        continue;
      }
      const resolved: ResolvedWorktree = {
        id: deriveWorktreeId(project.id, worktree.metadataIdentity),
        projectId: project.id,
        path: worktree.path,
        branch: worktree.branch,
        main: worktree.main,
        available: worktree.available,
        metadataIdentity: worktree.metadataIdentity,
        administrativeDirectory: worktree.administrativeDirectory,
        commonDirectory: discovered.repository.commonDirectory,
        repositoryIdentity: discovered.repository.repositoryIdentity,
      };
      worktrees.push(resolved);
    }
    this.forget(project.id);
    for (const worktree of worktrees) this.entries.set(worktree.id, worktree);
    return {
      projectId: project.id,
      worktrees,
      issues: discovered.issues,
      complete,
    };
  }

  private known(projectId: string): ResolvedWorktree[] {
    return [...this.entries.values()]
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => ({ ...entry, available: false }));
  }

  private async reread(
    entry: ResolvedWorktree,
  ): Promise<ResolvedWorktree | null> {
    let current: string;
    try {
      current = await identity(entry.administrativeDirectory);
    } catch {
      return null;
    }
    if (deriveWorktreeId(entry.projectId, current) !== entry.id) return null;
    const path = entry.main
      ? entry.path
      : await readGitdirPointer(entry.administrativeDirectory);
    if (!path) return null;
    const branch = await readHead(entry.administrativeDirectory);
    const refreshed = {
      ...entry,
      path,
      branch,
      available: await corroborates(path, entry.administrativeDirectory),
    };
    this.entries.set(entry.id, refreshed);
    return refreshed;
  }
}
