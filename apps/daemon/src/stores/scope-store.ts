import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  isEmptyWorktreeProfile,
  type ProfileLayer,
  type ResolvedProfile,
  resolveProfile,
  type WorktreeProfile,
} from '@porcelain/contracts'
import type { WorktreeProfileView } from '@porcelain/contracts/files'
import {
  emptyPrivateProjectDocument,
  type PrivateProjectDocument,
  privateProjectDocumentSchema,
  stripPersonalProfileFields,
} from '@porcelain/contracts/projects'
import { projectOverridePath } from '@shared/project-overrides'
import { projectOverlayOverridesPath } from '@shared/project-porcelain'
import { projectOverridesPath } from '@shared/project-store'

/**
 * The worktree profile store: pins, hides, and declared story layers, at two
 * levels (ADR 0003).
 *
 * The PROJECT level is the default and lives in the daemon-root private Project
 * store. The WORKTREE level is an optional override keyed by worktree id, and a
 * worktree without one simply inherits — live, not copied, so editing the
 * project profile moves every worktree that has not overridden it.
 *
 * Paths are stored **repo-relative** on disk; the scope API surfaces absolute
 * paths under the repo for tree matching, while the profile VIEW keeps them
 * relative because that is what a human reads and what the CLI writes.
 *
 * The tracked `<repo>/.porcelain/project.json` overlay is a second, read-only
 * source of project defaults — but only of hides and pins. Layers and worktree
 * overrides are stripped out of it on read as well as on promotion: a shared
 * layer order is a story written for someone else's task (ADR 0006), and
 * stripping on the read path makes smuggling one in impossible rather than
 * merely discouraged. Writes stay personal, so merely changing navigation never
 * edits a checkout's tracked bytes. This module deliberately never reads or
 * writes the retired `.scope.json`.
 */

export type RepoScope = { hiddenPaths: string[]; pinnedPaths: string[] }

/** Where a checkout sits in the Hub: which Project owns it, and which Worktree it is. */
export type RepoIdentity = { projectId: string; worktreeId: string | null }

export type ScopeStore = Readonly<{
  readRepoScope: (repoPath: string) => Promise<RepoScope>
  hiddenPathsForRepo: (repoPath: string) => Promise<Set<string>>
  pinnedPathsForRepo: (repoPath: string) => Promise<string[]>
  /** Declared story order for this checkout — empty when nothing is declared yet. */
  layersForRepo: (repoPath: string) => Promise<ProfileLayer[]>
  /** Project baseline, worktree override, and merge — for Settings → Personalization. */
  profileViewForRepo: (repoPath: string) => Promise<WorktreeProfileView>
  hidePath: (repoPath: string, path: string) => Promise<void>
  unhidePath: (repoPath: string, path: string) => Promise<void>
  pinPath: (repoPath: string, path: string) => Promise<void>
  unpinPath: (repoPath: string, path: string) => Promise<void>
}>

export type ScopeStoreOptions = Readonly<{
  homeDir: string
  identityForRepo: (repoPath: string) => Promise<RepoIdentity | null>
}>

/** Normalize user/agent input to a repo-relative path for storage. */
export const toRelativeScopePath = projectOverridePath

/** Absolute path under repo for a stored relative path. */
export function toAbsoluteScopePath(repoPath: string, rel: string): string {
  if (rel === '' || rel === '.') return repoPath
  return join(repoPath, rel)
}

function expandScope(repoPath: string, scope: RepoScope): RepoScope {
  return {
    hiddenPaths: scope.hiddenPaths.map((p) => toAbsoluteScopePath(repoPath, p)),
    pinnedPaths: scope.pinnedPaths.map((p) => toAbsoluteScopePath(repoPath, p)),
  }
}

export function createScopeStore(options: ScopeStoreOptions): ScopeStore {
  async function readDocument(path: string): Promise<PrivateProjectDocument> {
    try {
      const parsed = privateProjectDocumentSchema.safeParse(
        JSON.parse(await readFile(path, 'utf8')),
      )
      return parsed.success ? parsed.data : emptyPrivateProjectDocument()
    } catch {
      return emptyPrivateProjectDocument()
    }
  }

  async function readPrivate(identity: RepoIdentity | null): Promise<PrivateProjectDocument> {
    if (identity === null) return emptyPrivateProjectDocument()
    return readDocument(projectOverridesPath(options.homeDir, identity.projectId))
  }

  /**
   * Project defaults promoted into the checkout. Parsed with the tolerant private
   * schema and then STRIPPED — a hand-written `layers` in a tracked file must
   * neither take effect nor cost the reader the hides that file does legitimately
   * carry, and parsing with the strict tracked schema would have discarded both.
   */
  async function readTracked(repoPath: string): Promise<RepoScope> {
    return stripPersonalProfileFields(await readDocument(projectOverlayOverridesPath(repoPath)))
  }

  async function readProfileView(repoPath: string): Promise<WorktreeProfileView> {
    // Resolve the Hub identity ONCE. It scans the whole inventory, and the tree
    // asks for this on every directory read — doing it per sub-read turned one
    // scan per listing into two.
    const identity = await options.identityForRepo(repoPath)
    const [privateDoc, tracked] = await Promise.all([readPrivate(identity), readTracked(repoPath)])
    const base: ResolvedProfile = {
      hiddenPaths: [...new Set([...privateDoc.hiddenPaths, ...tracked.hiddenPaths])],
      pinnedPaths: [...new Set([...privateDoc.pinnedPaths, ...tracked.pinnedPaths])],
      layers: privateDoc.layers,
    }
    const worktreeId = identity?.worktreeId ?? null
    const stored = worktreeId === null ? undefined : privateDoc.worktreeProfiles[worktreeId]
    // An override that says nothing reads as no override at all, so a cleared
    // profile stops claiming a section in Personalization instead of showing
    // three empty lists that look like a bug.
    const override = stored !== undefined && !isEmptyWorktreeProfile(stored) ? stored : null
    return { worktreeId, base, override, resolved: resolveProfile(base, override) }
  }

  /** Resolved profile in repo-relative terms — the one merge every consumer reads. */
  async function readResolved(repoPath: string): Promise<ResolvedProfile> {
    return (await readProfileView(repoPath)).resolved
  }

  async function readRepoScope(repoPath: string): Promise<RepoScope> {
    const resolved = await readResolved(repoPath)
    return expandScope(repoPath, {
      hiddenPaths: resolved.hiddenPaths,
      pinnedPaths: resolved.pinnedPaths,
    })
  }

  /**
   * Read-modify-write the WHOLE private document.
   *
   * Spreading `next` over a fresh object here is what a hide gesture used to do
   * while writing `worktrees: {}` back — a click in the tree silently deleted
   * agent-written worktree setup. Now that the same document also carries layers
   * and worktree overrides, that shape of bug would erase someone's whole
   * profile on every pin. Preserve every field this update did not name.
   */
  async function mutate(
    repoPath: string,
    update: (document: PrivateProjectDocument, identity: RepoIdentity) => PrivateProjectDocument,
  ): Promise<void> {
    const identity = await options.identityForRepo(repoPath)
    if (identity === null) return
    const path = projectOverridesPath(options.homeDir, identity.projectId)
    const next = update(await readDocument(path), identity)
    await mkdir(join(options.homeDir, 'projects', identity.projectId), { recursive: true })
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`)
  }

  /** Drop `rel` from a worktree's override, leaving the map clean when it empties. */
  function withoutOverridePath(
    document: PrivateProjectDocument,
    identity: RepoIdentity,
    key: 'hiddenPaths' | 'pinnedPaths',
    rel: string,
  ): PrivateProjectDocument {
    const worktreeId = identity.worktreeId
    if (worktreeId === null) return document
    const override = document.worktreeProfiles[worktreeId]
    if (override === undefined || !override[key].includes(rel)) return document
    const next: WorktreeProfile = { ...override, [key]: override[key].filter((e) => e !== rel) }
    return {
      ...document,
      worktreeProfiles: { ...document.worktreeProfiles, [worktreeId]: next },
    }
  }

  /** Drop a now-contradicted `unhiddenPaths` entry so a hide gesture cannot no-op. */
  function withoutOverrideNegation(
    document: PrivateProjectDocument,
    identity: RepoIdentity,
    rel: string,
  ): PrivateProjectDocument {
    const worktreeId = identity.worktreeId
    if (worktreeId === null) return document
    const override = document.worktreeProfiles[worktreeId]
    if (override === undefined || !override.unhiddenPaths.includes(rel)) return document
    const next: WorktreeProfile = {
      ...override,
      unhiddenPaths: override.unhiddenPaths.filter((entry) => entry !== rel),
    }
    return { ...document, worktreeProfiles: { ...document.worktreeProfiles, [worktreeId]: next } }
  }

  /**
   * Add to the PROJECT baseline, not to this worktree's override.
   *
   * Inheritance is the default, so a human gesture means "everywhere" — which is
   * also what it meant before profiles existed. Task-shaped, worktree-only focus
   * is what the agent writes through `porcelain worktree profile set`.
   *
   * Hiding also clears this worktree's `unhiddenPaths` entry for the same path.
   * Without that, a worktree whose agent had opted the path back IN would take
   * the hide into the baseline and show no change at all — a gesture that
   * silently does nothing is worse than one that is unavailable.
   */
  function addToBase(key: 'hiddenPaths' | 'pinnedPaths', rel: string) {
    return (document: PrivateProjectDocument, identity: RepoIdentity): PrivateProjectDocument => {
      const cleared =
        key === 'hiddenPaths' ? withoutOverrideNegation(document, identity, rel) : document
      return cleared[key].includes(rel) ? cleared : { ...cleared, [key]: [...cleared[key], rel] }
    }
  }

  /**
   * Remove from BOTH levels.
   *
   * The escape hatch has to work in one gesture wherever the entry came from
   * (`docs/surfaces/worktree-profile.md`) — a user who cannot get a file back
   * cannot review it. Removing from the baseline does affect sibling worktrees,
   * and that is the honest reading of "shared by default": hide and unhide are
   * symmetric, and per-worktree divergence is the agent's job to express.
   */
  function removeFromBoth(key: 'hiddenPaths' | 'pinnedPaths', rel: string) {
    return (document: PrivateProjectDocument, identity: RepoIdentity): PrivateProjectDocument =>
      withoutOverridePath(
        { ...document, [key]: document[key].filter((entry) => entry !== rel) },
        identity,
        key,
        rel,
      )
  }

  return Object.freeze({
    readRepoScope,
    hiddenPathsForRepo: async (repoPath) => new Set((await readRepoScope(repoPath)).hiddenPaths),
    pinnedPathsForRepo: async (repoPath) => (await readRepoScope(repoPath)).pinnedPaths,
    layersForRepo: async (repoPath) => (await readResolved(repoPath)).layers,
    profileViewForRepo: readProfileView,
    hidePath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      if (rel !== '') await mutate(repoPath, addToBase('hiddenPaths', rel))
    },
    unhidePath: async (repoPath, path) => {
      await mutate(repoPath, removeFromBoth('hiddenPaths', toRelativeScopePath(repoPath, path)))
    },
    pinPath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      if (rel !== '') await mutate(repoPath, addToBase('pinnedPaths', rel))
    },
    unpinPath: async (repoPath, path) => {
      await mutate(repoPath, removeFromBoth('pinnedPaths', toRelativeScopePath(repoPath, path)))
    },
  })
}
