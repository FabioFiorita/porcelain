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

/** One instance: a timeout says the same thing whichever project hit it. */
const TIMED_OUT = new ProjectListingTimeoutError();

/**
 * Turns a worktree id into a worktree, without SQLite and usually without Git.
 *
 * Git is the source of truth, so nothing here is a cache of what a table said:
 * an entry records where a worktree's administrative directory is, and every
 * hit re-reads that directory. The identity has to still derive to the same id
 * — otherwise the worktree was replaced and this is a miss — and the checkout
 * path and branch are read from the repository's own `gitdir` and `HEAD`,
 * which is what `git worktree move` and a branch switch rewrite. A generation
 * over the parent directory's mtime would miss both.
 */
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

  /** One coalesced `git worktree list` per project. */
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

  /**
   * Every registered project, listed, in the order they are stored.
   *
   * Projects are listed together rather than one after another, so a slow
   * repository costs its own timeout instead of everybody's. What bounds Git
   * is the launch limit, not this fan-out: a caller that joins a listing
   * already in flight starts nothing.
   */
  async listAll(signal?: AbortSignal): Promise<ProjectListing[]> {
    return Promise.all(
      this.projects().map((project) => this.list(project, signal)),
    );
  }

  /**
   * The worktree an id names, or null.
   *
   * A hit costs one `stat` and two small file reads; a miss re-lists, because
   * an id the directory has never seen cannot be found any other way.
   */
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
    // Answered from the reread, never from the listing that put it there: if
    // the worktree was replaced in between, the entry is already a claim
    // about a directory that has stopped being this worktree.
    if (found) return this.reread(found);
    // Not finding an id while some project could not be listed is not the
    // same as the worktree being gone: an unplugged disk cannot tell us
    // either way, and answering "not found" would be a claim we cannot make.
    if (listings.some((listing) => listing.failure !== undefined))
      throw new RepositoryIdentityMismatchError();
    return null;
  }

  /**
   * The repository a known id belongs to, from memory only.
   *
   * Lanes are chosen before work starts, so this never waits on Git: an id the
   * directory has not seen has no lane to pick yet, and the request that
   * follows fails to resolve on its own.
   */
  repositoryOf(worktreeId: string): string | null {
    return this.entries.get(worktreeId)?.repositoryIdentity ?? null;
  }

  /**
   * Forget a project's worktrees.
   *
   * A removed project's checkouts are still on disk and their administrative
   * directories still corroborate, so an entry left here would keep resolving
   * ids whose project no longer exists — and review data written for one would
   * fail against the foreign key rather than answer "not found".
   */
  forget(projectId: string) {
    for (const [id, entry] of this.entries)
      if (entry.projectId === projectId) this.entries.delete(id);
  }

  private async listNow(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<ProjectListing> {
    let discovered: DiscoveryResult;
    // This project's own share of the wait, started when its Git process
    // starts rather than when it joins the queue: a healthy repository behind
    // four slow ones must not be reported unavailable for waiting its turn.
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
      // The caller leaving, or shutdown, is still cancellation and belongs to
      // whoever asked. Only this project's own deadline is data.
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
      // A repository that cannot be read is data. Git missing from the machine
      // is a fault, and must not be reported as every project being
      // unavailable — that would hide a broken installation behind an empty
      // sidebar.
      if (!isRepositoryUnavailable(failure)) throw failure;
      // A project that cannot be listed keeps whatever the directory knows: an
      // unplugged disk must not look like a set of deleted worktrees.
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
      // A different repository now sits where this project was registered.
      // Listing its worktrees would attach this project's review data to
      // someone else's checkouts.
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
      // Git printed this worktree but its identity could not be derived, so
      // it has no id to be listed under. The listing is short by one, and
      // saying so is what keeps the cleanup off the worktrees it dropped.
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

  /**
   * What was last listed for a project, reported unavailable.
   *
   * A project that cannot be listed cannot have reachable worktrees: keeping
   * the last-known paths lets the workspace stay on screen, but claiming they
   * are available would invite a read that must fail.
   */
  private known(projectId: string): ResolvedWorktree[] {
    return [...this.entries.values()]
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => ({ ...entry, available: false }));
  }

  /**
   * Re-read one entry from the repository's own registry. Null means the
   * worktree this id named is no longer there — replaced, pruned, or a
   * directory that no longer belongs to this project.
   *
   * The checkout has to agree that it belongs to this administrative
   * directory, every time. The registry only records where a checkout was:
   * move one away and put another repository at that path, and the pointer
   * still reads the same. Without asking the checkout itself, a request
   * carrying the old id would be answered with a stranger's files. A checkout
   * that cannot corroborate stays known — its review data is not collected —
   * but is not available, so nothing is read from it.
   */
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
    // A main checkout's path is not written down anywhere Git reads back, so
    // it stays what the last listing said until a listing corrects it.
    const path = entry.main
      ? entry.path
      : await readGitdirPointer(entry.administrativeDirectory);
    if (!path) return null;
    // Null is an answer here, not a failure: a detached checkout has no
    // branch, and the administrative directory is readable or we returned.
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
