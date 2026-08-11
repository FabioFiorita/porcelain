#!/usr/bin/env node
/**
 * Stop-closed postconditions between sequential recipe launches.
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseCatalogStatuses, recipeStatus, resolveRecipePath } from './manifest.mjs'

/**
 * Snapshot catalog + recipe statuses for the given IDs (and all catalog rows).
 * @param {{ catalogText: string, specsRoot: string, recipeIds: string[] }} options
 * @returns {{ catalog: Record<string, string>, recipes: Record<string, string | null> }}
 */
export function snapshotStatuses(options) {
  const catalogMap = parseCatalogStatuses(options.catalogText)
  const catalog = Object.fromEntries(catalogMap)
  const recipes = {}
  for (const id of options.recipeIds) {
    const path = resolveRecipePath(options.specsRoot, id)
    if (!path || !existsSync(path)) {
      recipes[id] = null
      continue
    }
    recipes[id] = recipeStatus(readFileSync(path, 'utf8'))
  }
  return { catalog, recipes }
}

/**
 * @param {{
 *   exitCode: number | null,
 *   startingHead: string,
 *   endingHead: string | null,
 *   worktreeClean: boolean,
 *   packetPath: string,
 *   packetExists: boolean,
 *   recipeId: string,
 *   before: { catalog: Record<string, string>, recipes: Record<string, string | null> },
 *   after: { catalog: Record<string, string>, recipes: Record<string, string | null> },
 *   allGroupRecipeIds: string[],
 * }} input
 * @returns {{ ok: true } | { ok: false, reasons: string[] }}
 */
export function evaluatePostconditions(input) {
  const reasons = []

  if (input.exitCode !== 0) {
    reasons.push(`executor exit code was ${input.exitCode ?? 'null'}, expected 0`)
  }
  if (!input.endingHead || !/^[0-9a-f]{7,40}$/i.test(input.endingHead)) {
    reasons.push('ending HEAD is missing or invalid')
  } else if (input.endingHead === input.startingHead) {
    reasons.push('HEAD did not advance; expected a new commit')
  }
  if (!input.worktreeClean) {
    reasons.push('worktree is not clean after the recipe')
  }
  if (!input.packetExists) {
    reasons.push(`required packet missing: ${input.packetPath}`)
  }

  const afterCatalog = input.after.catalog[input.recipeId]
  const afterRecipe = input.after.recipes[input.recipeId]
  if (afterCatalog !== 'Landed') {
    reasons.push(
      `catalog status for ${input.recipeId} is ${afterCatalog ?? 'missing'}, expected Landed`,
    )
  }
  if (afterRecipe !== 'Landed') {
    reasons.push(
      `recipe file status for ${input.recipeId} is ${afterRecipe ?? 'missing'}, expected Landed`,
    )
  }

  // Unrelated recipes in this group must not change status (except the one we ran).
  for (const id of input.allGroupRecipeIds) {
    if (id === input.recipeId) continue
    const beforeCat = input.before.catalog[id]
    const afterCat = input.after.catalog[id]
    if (beforeCat !== afterCat) {
      reasons.push(`unrelated catalog status changed for ${id}: ${beforeCat} → ${afterCat}`)
    }
    const beforeRec = input.before.recipes[id]
    const afterRec = input.after.recipes[id]
    if (beforeRec !== afterRec) {
      reasons.push(`unrelated recipe status changed for ${id}: ${beforeRec} → ${afterRec}`)
    }
  }

  // Outside the group: any status change is also a stop (compare full catalog maps).
  for (const [id, beforeStatus] of Object.entries(input.before.catalog)) {
    if (id === input.recipeId) continue
    if (input.allGroupRecipeIds.includes(id)) continue
    const afterStatus = input.after.catalog[id]
    if (beforeStatus !== afterStatus) {
      reasons.push(
        `out-of-group catalog status changed for ${id}: ${beforeStatus} → ${afterStatus}`,
      )
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons }
}
