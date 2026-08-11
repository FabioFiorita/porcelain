#!/usr/bin/env node
/**
 * Schema-validated architecture execution-group manifests.
 *
 * One file describes one group: ordered recipes, executor, base ref, and optional
 * group-level dependencies. Unknown fields fail closed.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { normalizeBaseRef } from '../worktree.mjs'

export const MANIFEST_VERSION = 1
export const EXECUTORS = Object.freeze(['grok', 'claude-personal'])
export const RECIPE_ID_PATTERN = /^[A-Z][A-Z0-9]*-\d{3}$/
export const GROUP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/

const ALLOWED_FIELDS = new Set([
  'version',
  'id',
  'slug',
  'base',
  'executor',
  'recipes',
  'dependsOn',
])

/**
 * @typedef {{
 *   version: 1,
 *   id: string,
 *   slug: string,
 *   base: string,
 *   executor: 'grok' | 'claude-personal',
 *   recipes: string[],
 *   dependsOn: string[],
 * }} ExecutionGroup
 */

function err(message) {
  return { ok: false, error: message, group: null, errors: [message] }
}

/**
 * Parse a single group object (no filesystem). Catalog/recipe checks are separate.
 * @param {unknown} value
 * @returns {{ ok: true, group: ExecutionGroup, errors: [] } | { ok: false, group: null, error: string, errors: string[] }}
 */
export function parseExecutionGroup(value) {
  const errors = []
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return err('manifest must be a JSON object')
  }
  const obj = /** @type {Record<string, unknown>} */ (value)
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`unknown field: ${key}`)
  }
  if (obj.version !== MANIFEST_VERSION) {
    errors.push(`version must be ${MANIFEST_VERSION}`)
  }

  const id = typeof obj.id === 'string' ? obj.id.trim() : ''
  if (!GROUP_ID_PATTERN.test(id)) {
    errors.push('id must be 2–48 lowercase letters, numbers, or hyphens')
  }

  // Same shape as managed worktree slugs (shared path namespace).
  const slug = typeof obj.slug === 'string' ? obj.slug.trim() : id
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) {
    errors.push('slug must be 2–48 lowercase letters, numbers, or hyphens')
  }

  let base = 'main'
  if (obj.base !== undefined) {
    const baseErrors = []
    base = normalizeBaseRef(obj.base, (message) => {
      baseErrors.push(message)
      return undefined
    })
    if (baseErrors.length > 0 || base === undefined) {
      errors.push(baseErrors[0] ?? 'base is invalid')
      base = 'main'
    }
  }

  const executor = obj.executor
  if (executor !== 'grok' && executor !== 'claude-personal') {
    errors.push(`executor must be one of: ${EXECUTORS.join(', ')}`)
  }

  if (!Array.isArray(obj.recipes) || obj.recipes.length === 0) {
    errors.push('recipes must be a non-empty array of recipe IDs')
  }
  const recipes = []
  if (Array.isArray(obj.recipes)) {
    for (const [index, entry] of obj.recipes.entries()) {
      if (typeof entry !== 'string' || !RECIPE_ID_PATTERN.test(entry)) {
        errors.push(`recipes[${index}] must match ${RECIPE_ID_PATTERN}`)
        continue
      }
      recipes.push(entry)
    }
    if (new Set(recipes).size !== recipes.length) {
      errors.push('recipes must not contain duplicates')
    }
  }

  const dependsOn = []
  if (obj.dependsOn !== undefined) {
    if (!Array.isArray(obj.dependsOn)) {
      errors.push('dependsOn must be an array of group ids')
    } else {
      for (const [index, entry] of obj.dependsOn.entries()) {
        if (typeof entry !== 'string' || !GROUP_ID_PATTERN.test(entry)) {
          errors.push(`dependsOn[${index}] must be a valid group id`)
          continue
        }
        dependsOn.push(entry)
      }
      if (new Set(dependsOn).size !== dependsOn.length) {
        errors.push('dependsOn must not contain duplicates')
      }
      if (dependsOn.includes(id)) {
        errors.push('dependsOn must not include the group itself')
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, group: null, error: errors[0], errors }
  }

  return {
    ok: true,
    group: {
      version: 1,
      id,
      slug,
      base,
      executor: /** @type {'grok' | 'claude-personal'} */ (executor),
      recipes,
      dependsOn,
    },
    errors: [],
  }
}

/**
 * Load and parse a manifest file from disk.
 * @param {string} filePath
 */
export function loadManifestFile(filePath) {
  if (!existsSync(filePath)) return err(`manifest not found: ${filePath}`)
  let raw
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (error) {
    return err(
      `manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return parseExecutionGroup(raw)
}

/**
 * Catalog status map from catalog.md text.
 * @param {string} catalogText
 * @returns {Map<string, string>}
 */
export function parseCatalogStatuses(catalogText) {
  const map = new Map()
  for (const match of catalogText.matchAll(
    /^\| `([A-Z][A-Z0-9]*-\d{3})` \| (Landed|Draft|Queued|Ready|Blocked) \|/gm,
  )) {
    map.set(match[1], match[2])
  }
  return map
}

/**
 * Resolve a recipe file path for an ID under specsRoot.
 * @param {string} specsRoot
 * @param {string} id
 * @returns {string | null}
 */
export function resolveRecipePath(specsRoot, id) {
  if (!existsSync(specsRoot)) return null
  const matches = readdirSync(specsRoot).filter(
    (name) => name === `${id}.md` || name.startsWith(`${id}-`),
  )
  if (matches.length !== 1) return null
  return join(specsRoot, matches[0])
}

/**
 * Dependencies listed in a recipe body.
 * @param {string} recipeText
 */
export function dependenciesForRecipe(recipeText) {
  const depends = /^- Depends on: (.+)$/m.exec(recipeText)?.[1] ?? ''
  return [...depends.matchAll(/[A-Z][A-Z0-9]*-\d{3}/g)].map((match) => match[0])
}

/**
 * Recipe status line.
 * @param {string} recipeText
 */
export function recipeStatus(recipeText) {
  return /^- Status: (Landed|Draft|Queued|Ready|Blocked)$/m.exec(recipeText)?.[1] ?? null
}

/**
 * Whether a catalog+recipe pair is executable (Ready, or Queued with deps Landed).
 * @param {string} id
 * @param {Map<string, string>} catalog
 * @param {string} recipeText
 */
export function isExecutableRecipe(id, catalog, recipeText) {
  const status = catalog.get(id)
  const fileStatus = recipeStatus(recipeText)
  if (status !== fileStatus) return false
  if (status === 'Ready') {
    return dependenciesForRecipe(recipeText).every((dep) => catalog.get(dep) === 'Landed')
  }
  if (status === 'Queued') {
    return dependenciesForRecipe(recipeText).every((dep) => catalog.get(dep) === 'Landed')
  }
  return false
}

/**
 * Validate group against the live catalog and recipe files.
 * @param {ExecutionGroup} group
 * @param {{ catalogText: string, specsRoot: string, otherGroups?: ExecutionGroup[] }} context
 */
export function validateGroupAgainstCatalog(group, context) {
  const errors = []
  const catalog = parseCatalogStatuses(context.catalogText)

  for (const id of group.recipes) {
    if (!catalog.has(id)) {
      errors.push(`recipe ${id} is not in the catalog`)
      continue
    }
    const path = resolveRecipePath(context.specsRoot, id)
    if (!path) {
      errors.push(`recipe ${id} does not resolve to exactly one recipe file`)
      continue
    }
    let text
    try {
      text = readFileSync(path, 'utf8')
    } catch {
      errors.push(`recipe ${id} file is unreadable`)
      continue
    }
    if (!new RegExp(`^# ${id} — .+$`, 'm').test(text)) {
      errors.push(`recipe ${id} file title does not match`)
    }
    const status = recipeStatus(text)
    const catalogStatus = catalog.get(id)
    if (status !== catalogStatus) {
      errors.push(`recipe ${id} is ${status} in file but ${catalogStatus} in catalog`)
    }
    if (status !== 'Ready' && status !== 'Queued') {
      errors.push(`recipe ${id} status is ${status ?? 'missing'}; need Ready or Queued`)
      continue
    }
    const deps = dependenciesForRecipe(text)
    for (const dep of deps) {
      if (!catalog.has(dep)) errors.push(`recipe ${id} depends on unknown ${dep}`)
    }
    // At validate time we only require that dependency IDs exist. Executable
    // readiness (deps Landed) is re-checked immediately before each launch.
    if (status === 'Ready') {
      const unlanded = deps.filter((dep) => catalog.get(dep) !== 'Landed')
      if (unlanded.length > 0) {
        errors.push(`recipe ${id} is Ready but dependencies not Landed: ${unlanded.join(', ')}`)
      }
    }
  }

  // Overlap with sibling groups in the same batch file set.
  if (context.otherGroups) {
    const claimed = new Map()
    for (const other of context.otherGroups) {
      if (other.id === group.id) continue
      for (const recipe of other.recipes) claimed.set(recipe, other.id)
    }
    for (const recipe of group.recipes) {
      const owner = claimed.get(recipe)
      if (owner) errors.push(`recipe ${recipe} also appears in group ${owner}`)
    }
  }

  return errors
}

/**
 * Detect cycles among group dependsOn edges.
 * @param {ExecutionGroup[]} groups
 * @returns {string[]}
 */
export function findGroupCycles(groups) {
  const graph = new Map(groups.map((g) => [g.id, g.dependsOn]))
  const errors = []
  const visited = new Set()
  const active = new Set()
  const stack = []

  function visit(id) {
    if (active.has(id)) {
      const start = stack.indexOf(id)
      errors.push(`group dependency cycle: ${[...stack.slice(start), id].join(' -> ')}`)
      return
    }
    if (visited.has(id)) return
    visited.add(id)
    active.add(id)
    stack.push(id)
    for (const dep of graph.get(id) ?? []) {
      if (graph.has(dep)) visit(dep)
      else if (![...graph.keys()].includes(dep)) {
        // dangling dependsOn is reported elsewhere when validating a set
      }
    }
    stack.pop()
    active.delete(id)
  }

  for (const id of graph.keys()) visit(id)
  return errors
}

/**
 * Validate a set of groups for overlap, unknown dependsOn, and cycles.
 * @param {ExecutionGroup[]} groups
 * @param {{ catalogText: string, specsRoot: string }} context
 */
export function validateGroupSet(groups, context) {
  const errors = []
  const ids = new Set()
  const recipeOwners = new Map()

  for (const group of groups) {
    if (ids.has(group.id)) errors.push(`duplicate group id: ${group.id}`)
    ids.add(group.id)
    for (const recipe of group.recipes) {
      if (recipeOwners.has(recipe)) {
        errors.push(
          `recipe ${recipe} appears in groups ${recipeOwners.get(recipe)} and ${group.id}`,
        )
      } else {
        recipeOwners.set(recipe, group.id)
      }
    }
  }

  for (const group of groups) {
    for (const dep of group.dependsOn) {
      if (!ids.has(dep)) errors.push(`group ${group.id} dependsOn unknown group ${dep}`)
    }
    errors.push(
      ...validateGroupAgainstCatalog(group, {
        ...context,
        otherGroups: groups,
      }),
    )
  }

  errors.push(...findGroupCycles(groups))
  return errors
}

/**
 * Load every `*.group.json` under a directory (non-recursive).
 * @param {string} dir
 */
export function loadGroupDirectory(dir) {
  if (!existsSync(dir)) return { ok: false, groups: [], errors: [`directory not found: ${dir}`] }
  const files = readdirSync(dir)
    // template.group.json is a documented scaffold, not a live group.
    .filter((name) => name.endsWith('.group.json') && name !== 'template.group.json')
    .sort()
  const groups = []
  const errors = []
  for (const name of files) {
    const result = loadManifestFile(join(dir, name))
    if (!result.ok) {
      errors.push(`${name}: ${result.error}`)
      continue
    }
    groups.push(result.group)
  }
  return { ok: errors.length === 0, groups, errors, files: files.map((name) => join(dir, name)) }
}

export function manifestBasename(filePath) {
  return basename(filePath)
}
