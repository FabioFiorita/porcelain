#!/usr/bin/env node
/**
 * Atomic orchestration state under gitignored agent-scratch.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

export const STATE_VERSION = 1
export const STATE_FILE = 'state.json'

/**
 * @param {string} repoRoot
 * @param {string} groupId
 */
export function orchestrationDir(repoRoot, groupId) {
  // Group ids are already validated as slug-like; still reject path segments.
  if (
    groupId.includes('..') ||
    groupId.includes(sep) ||
    groupId.includes('/') ||
    groupId.includes('\\')
  ) {
    throw new Error(`refusing orchestration path for unsafe group id: ${groupId}`)
  }
  return join(repoRoot, 'scripts', 'agent-scratch', 'orchestration', groupId)
}

/**
 * Ensure the orchestration dir stays under agent-scratch/orchestration.
 * @param {string} repoRoot
 * @param {string} target
 */
export function assertUnderOrchestrationRoot(repoRoot, target) {
  const root = resolve(join(repoRoot, 'scripts', 'agent-scratch', 'orchestration'))
  const resolved = resolve(target)
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error(`refusing path outside orchestration root: ${resolved}`)
  }
  return resolved
}

/**
 * Atomic JSON write (tmp + rename).
 * @param {string} filePath
 * @param {unknown} value
 */
export function writeJsonAtomic(filePath, value) {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  renameSync(tmp, filePath)
}

/**
 * @param {string} filePath
 * @returns {unknown | null}
 */
export function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

/**
 * @param {object} partial
 */
export function createInitialState(partial) {
  return {
    version: STATE_VERSION,
    groupId: partial.groupId,
    slug: partial.slug,
    base: partial.base,
    executor: partial.executor,
    recipes: [...partial.recipes],
    dependsOn: [...(partial.dependsOn ?? [])],
    status: partial.status ?? 'prepared',
    worktreePath: partial.worktreePath ?? null,
    branch: partial.branch ?? null,
    currentRecipe: null,
    pid: null,
    startTime: null,
    endTime: null,
    exitCode: null,
    startingHead: partial.startingHead ?? null,
    endingHead: null,
    groupStartingHead: partial.groupStartingHead ?? null,
    completed: [],
    failed: null,
    recipeRuns: [],
    notes: partial.notes ?? [],
  }
}

/**
 * Canonical identity fields compared at run against the live manifest + snapshot.
 * @param {{ id?: string, groupId?: string, slug: string, base: string, executor: string, recipes: string[], dependsOn?: string[] }} value
 */
export function identityFromManifestOrState(value) {
  return {
    id: value.id ?? value.groupId,
    slug: value.slug,
    base: value.base,
    executor: value.executor,
    recipes: [...(value.recipes ?? [])],
    dependsOn: [...(value.dependsOn ?? [])],
  }
}

/**
 * Strict field equality for prepared identity (ordered recipes/dependsOn).
 * @param {ReturnType<typeof identityFromManifestOrState>} a
 * @param {ReturnType<typeof identityFromManifestOrState>} b
 */
export function identitiesEqual(a, b) {
  return (
    a.id === b.id &&
    a.slug === b.slug &&
    a.base === b.base &&
    a.executor === b.executor &&
    JSON.stringify(a.recipes) === JSON.stringify(b.recipes) &&
    JSON.stringify(a.dependsOn) === JSON.stringify(b.dependsOn)
  )
}

/**
 * @param {string} dir
 * @param {object} state
 */
export function writeState(dir, state) {
  assertUnderOrchestrationRoot(
    // dir is .../orchestration/<id>; walk up to repo by stripping three segments
    // only for the guard root derivation when repoRoot is unknown — prefer passing
    // via state. For safety, require dir itself to contain orchestration.
    (() => {
      const marker = `${sep}scripts${sep}agent-scratch${sep}orchestration`
      const idx = dir.lastIndexOf(marker)
      if (idx === -1) throw new Error(`state dir is not under orchestration: ${dir}`)
      return dir.slice(0, idx)
    })(),
    dir,
  )
  writeJsonAtomic(join(dir, STATE_FILE), state)
}

/**
 * @param {string} dir
 */
export function readState(dir) {
  const value = readJsonFile(join(dir, STATE_FILE))
  if (value === null) return null
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('state.json is not an object')
  }
  return value
}
