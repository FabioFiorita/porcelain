import { lstat, realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type {
  ProjectRootResolution,
  ResolveExistingResult,
  ResolveMissingCapableResult,
} from './files-ports'

/** Shared outside predicate — NEVER use startsWith('..') alone; NEVER string-prefix root checks. */
export function isPathOutsideRoot(rootReal: string, absolute: string): boolean {
  const rel = relative(rootReal, absolute)
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
}

export async function resolveProjectRoot(projectPathWire: string): Promise<ProjectRootResolution> {
  // Contract already guaranteed POSIX absolute + non-NUL + bounds.
  let projectRootReal: string
  try {
    projectRootReal = await realpath(projectPathWire)
  } catch {
    // including ENOENT, ENOTDIR, ELOOP on the root itself
    return { ok: false, reason: 'unusable-project-root' }
  }
  try {
    const st = await stat(projectRootReal)
    if (!st.isDirectory()) {
      return { ok: false, reason: 'unusable-project-root' }
    }
  } catch {
    return { ok: false, reason: 'unusable-project-root' }
  }
  return { ok: true, projectPathWire, projectRootReal }
}

export type JoinLexicalResult =
  | { ok: true; lexicalAbsolute: string }
  | { ok: false; reason: 'outside' }

export function joinLexical(projectRootReal: string, relativePath: string): JoinLexicalResult {
  const absolute = resolve(projectRootReal, relativePath)
  if (isPathOutsideRoot(projectRootReal, absolute) || relative(projectRootReal, absolute) === '') {
    // '' means the project root itself — not a file target
    return { ok: false, reason: 'outside' }
  }
  return { ok: true, lexicalAbsolute: absolute }
}

type AncestorClassification =
  | { kind: 'path-outside' }
  | { kind: 'not-found' }
  | { kind: 'contained-ancestor'; ancestorLexical: string; ancestorReal: string }

/**
 * Shared ancestor classifier. Starts at startCandidate and climbs.
 * Return not-found ONLY after no outside / unresolved dangling / ELOOP link exists
 * on the chain.
 */
async function classifyAncestors(
  projectRootReal: string,
  startCandidate: string,
): Promise<AncestorClassification> {
  let candidate = startCandidate
  for (;;) {
    // Climbed past the declared root with no outside/unresolved/loop link under it.
    if (candidate !== projectRootReal && isPathOutsideRoot(projectRootReal, candidate)) {
      return { kind: 'not-found' }
    }

    try {
      const candidateReal = await realpath(candidate)
      // Successful realpath: exact containment check (no string-prefix).
      if (isPathOutsideRoot(projectRootReal, candidateReal)) {
        return { kind: 'path-outside' } // resolvable intermediate → outside
      }
      return {
        kind: 'contained-ancestor',
        ancestorLexical: candidate,
        ancestorReal: candidateReal,
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ELOOP') {
        return { kind: 'path-outside' } // intermediate (or looped) symlink cycle
      }
      if (code !== 'ENOENT') throw err

      // Capture lstat separately; never throw the realpath ENOENT inside this
      // try, where its own catch could mistake it for lstat ENOENT.
      let cl: Awaited<ReturnType<typeof lstat>> | null = null
      try {
        cl = await lstat(candidate)
      } catch (lstatErr) {
        if ((lstatErr as NodeJS.ErrnoException).code !== 'ENOENT') throw lstatErr
      }
      if (cl !== null) {
        if (cl.isSymbolicLink()) {
          return { kind: 'path-outside' } // dangling intermediate
        }
        throw new Error('realpath ENOENT with present non-symlink ancestor')
      }
      // True absence — climb
      if (candidate === projectRootReal) {
        return { kind: 'not-found' }
      }
      candidate = dirname(candidate)
    }
  }
}

export async function resolveExisting(
  projectRootReal: string,
  relativePath: string,
): Promise<ResolveExistingResult> {
  const joined = joinLexical(projectRootReal, relativePath)
  if (!joined.ok) {
    return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
  }
  const { lexicalAbsolute } = joined

  let resolvedAbsolute: string
  try {
    resolvedAbsolute = await realpath(lexicalAbsolute)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ELOOP') {
      // Final or intermediate symlink loop during target resolution
      return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
    }
    if (code !== 'ENOENT') throw err

    // realpath ENOENT: distinguish final dangling vs true absence vs outside chain
    let lst: Awaited<ReturnType<typeof lstat>> | null = null
    try {
      lst = await lstat(lexicalAbsolute)
    } catch (lstatErr) {
      if ((lstatErr as NodeJS.ErrnoException).code !== 'ENOENT') throw lstatErr
    }
    if (lst !== null) {
      if (lst.isSymbolicLink()) {
        // Final dangling symlink — containment unproven
        return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
      }
      throw new Error('realpath ENOENT with present non-symlink target')
    }
    // lstat ENOENT: MUST inspect ancestors BEFORE returning not-found
    const classification = await classifyAncestors(projectRootReal, dirname(lexicalAbsolute))
    if (classification.kind === 'path-outside') {
      return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
    }
    // contained-ancestor or not-found → soft/mutation not-found (leaf truly absent under contained chain)
    return { ok: false, error: { code: 'not-found', path: relativePath } }
  }

  // realpath(lexicalAbsolute) succeeded (final + intermediate symlinks followed when resolvable)
  if (
    isPathOutsideRoot(projectRootReal, resolvedAbsolute) ||
    relative(projectRootReal, resolvedAbsolute) === ''
  ) {
    return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
  }
  return {
    ok: true,
    value: { relative: relativePath, lexicalAbsolute, resolvedAbsolute },
  }
}

export async function resolveMissingCapable(
  projectRootReal: string,
  relativePath: string,
): Promise<ResolveMissingCapableResult> {
  const joined = joinLexical(projectRootReal, relativePath)
  if (!joined.ok) {
    return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
  }
  const { lexicalAbsolute } = joined

  // Leaf present as ANY directory entry type (file, dir, or symlink)?
  let lst: Awaited<ReturnType<typeof lstat>> | null = null
  try {
    lst = await lstat(lexicalAbsolute)
  } catch (lstatErr) {
    if ((lstatErr as NodeJS.ErrnoException).code !== 'ENOENT') throw lstatErr
  }

  if (lst !== null) {
    // ALWAYS call resolveExisting for real containment — NOT only when the leaf is a symlink.
    // Closes existing non-symlink leaves reached through outside intermediate symlinks.
    const existing = await resolveExisting(projectRootReal, relativePath)
    if (!existing.ok) return existing
    return {
      ok: true,
      value: {
        relative: relativePath,
        lexicalAbsolute, // namespace I/O path
        ioAbsolute: existing.value.resolvedAbsolute, // authorization evidence only
        leafExists: true,
      },
    }
  }

  // Leaf absent: nearest-existing-ancestor walk with the SAME classified rules.
  // segmentsUnderAncestor: basenames from the first missing component down to the leaf,
  // in order from ancestor-child toward leaf.
  const segmentsUnderAncestor = [basename(lexicalAbsolute)]
  let candidate = dirname(lexicalAbsolute)

  for (;;) {
    // Climbed past declared root → not-found (no outside/unresolved link under root)
    if (candidate !== projectRootReal && isPathOutsideRoot(projectRootReal, candidate)) {
      return { ok: false, error: { code: 'not-found', path: relativePath } }
    }

    let ancestorReal: string
    try {
      ancestorReal = await realpath(candidate)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ELOOP') {
        return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
      }
      if (code !== 'ENOENT') throw err
      // candidate missing or dangling
      let cl: Awaited<ReturnType<typeof lstat>> | null = null
      try {
        cl = await lstat(candidate)
      } catch (l2) {
        if ((l2 as NodeJS.ErrnoException).code !== 'ENOENT') throw l2
      }
      if (cl !== null) {
        if (cl.isSymbolicLink()) {
          return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
        }
        throw new Error('realpath ENOENT with present non-symlink ancestor')
      }
      // truly missing component — climb
      if (candidate === projectRootReal) {
        return { ok: false, error: { code: 'not-found', path: relativePath } }
      }
      segmentsUnderAncestor.unshift(basename(candidate))
      candidate = dirname(candidate)
      continue
    }

    // realpath(candidate) succeeded — exact containment (no string-prefix)
    if (isPathOutsideRoot(projectRootReal, ancestorReal)) {
      return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
    }
    // contained ancestor: reconstruct remaining lexical suffix under ancestorReal
    let ioAbsolute = ancestorReal
    for (const seg of segmentsUnderAncestor) {
      ioAbsolute = resolve(ioAbsolute, seg)
    }
    if (
      isPathOutsideRoot(projectRootReal, ioAbsolute) ||
      relative(projectRootReal, ioAbsolute) === ''
    ) {
      return { ok: false, error: { code: 'path-outside-project', path: relativePath } }
    }
    return {
      ok: true,
      value: {
        relative: relativePath,
        lexicalAbsolute,
        ioAbsolute,
        leafExists: false,
      },
    }
  }
}
