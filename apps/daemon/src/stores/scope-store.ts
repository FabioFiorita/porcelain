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
 * The profile store: project-owned pins/hides and story layers, with optional
 * worktree-specific story layers.
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
 * layer order is a story written for someone else's task, and
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
  /** Project baseline, worktree layer override, and resolved profile. */
  profileViewForRepo: (repoPath: string) => Promise<WorktreeProfileView>
  setProjectProfile: (repoPath: string, profile: ResolvedProfile) => Promise<void>
  setWorktreeProfile: (repoPath: string, profile: WorktreeProfile | null) => Promise<void>
  hidePath: (repoPath: string, path: string) => Promise<void>
  unhidePath: (repoPath: string, path: string) => Promise<void>
  pinPath: (repoPath: string, path: string) => Promise<void>
  unpinPath: (repoPath: string, path: string) => Promise<void>
  renamePath: (repoPath: string, from: string, to: string) => Promise<void>
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
    // An override that says nothing reads as no override at all.
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
   * Read-modify-write the WHOLE private document so a navigation gesture preserves personal
   * layers and Worktree profile overrides it did not name.
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

  /** Add to the project-owned navigation paths shared by every worktree. */
  function addToBase(key: 'hiddenPaths' | 'pinnedPaths', rel: string) {
    return (document: PrivateProjectDocument): PrivateProjectDocument =>
      document[key].includes(rel) ? document : { ...document, [key]: [...document[key], rel] }
  }

  /** Remove from the project-owned navigation paths shared by every worktree. */
  function removeFromBase(key: 'hiddenPaths' | 'pinnedPaths', rel: string) {
    return (document: PrivateProjectDocument): PrivateProjectDocument => ({
      ...document,
      [key]: document[key].filter((entry) => entry !== rel),
    })
  }

  function renamedPath(entry: string, from: string, to: string): string {
    if (entry === from) return to
    return entry.startsWith(`${from}/`) ? `${to}${entry.slice(from.length)}` : entry
  }

  return Object.freeze({
    readRepoScope,
    hiddenPathsForRepo: async (repoPath) => new Set((await readRepoScope(repoPath)).hiddenPaths),
    pinnedPathsForRepo: async (repoPath) => (await readRepoScope(repoPath)).pinnedPaths,
    layersForRepo: async (repoPath) => (await readResolved(repoPath)).layers,
    profileViewForRepo: readProfileView,
    setProjectProfile: async (repoPath, profile) => {
      await mutate(repoPath, (document) => ({
        ...document,
        pinnedPaths: profile.pinnedPaths,
        hiddenPaths: profile.hiddenPaths,
        layers: profile.layers,
      }))
    },
    setWorktreeProfile: async (repoPath, profile) => {
      await mutate(repoPath, (document, identity) => {
        if (identity.worktreeId === null) return document
        const worktreeProfiles = { ...document.worktreeProfiles }
        if (profile === null || isEmptyWorktreeProfile(profile))
          delete worktreeProfiles[identity.worktreeId]
        else worktreeProfiles[identity.worktreeId] = profile
        return { ...document, worktreeProfiles }
      })
    },
    hidePath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      if (rel !== '') await mutate(repoPath, addToBase('hiddenPaths', rel))
    },
    unhidePath: async (repoPath, path) => {
      await mutate(repoPath, removeFromBase('hiddenPaths', toRelativeScopePath(repoPath, path)))
    },
    pinPath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      if (rel !== '') await mutate(repoPath, addToBase('pinnedPaths', rel))
    },
    unpinPath: async (repoPath, path) => {
      await mutate(repoPath, removeFromBase('pinnedPaths', toRelativeScopePath(repoPath, path)))
    },
    renamePath: async (repoPath, from, to) => {
      const fromRel = toRelativeScopePath(repoPath, from)
      const toRel = toRelativeScopePath(repoPath, to)
      if (fromRel === '' || toRel === '') return
      await mutate(repoPath, (document) => ({
        ...document,
        hiddenPaths: document.hiddenPaths.map((entry) => renamedPath(entry, fromRel, toRel)),
        pinnedPaths: document.pinnedPaths.map((entry) => renamedPath(entry, fromRel, toRel)),
      }))
    },
  })
}
