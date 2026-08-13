#!/usr/bin/env node
/**
 * AGT-002 — keep the authored Companion procedure explicit-only and migration-free.
 *
 * This gate reads only repository-authored Companion sources. It does not inspect or mutate
 * installed skills, project companion data, or any daemon state.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const COMPANION_FOUNDATION_FILES = Object.freeze([
  'skills/porcelain-companion/SKILL.md',
  'skills/porcelain-companion/references/review.md',
  'skills/porcelain-companion/references/board.md',
  'skills/porcelain-companion/references/sync-environments.md',
  'skills/porcelain-companion/references/scope.md',
  'skills/porcelain-companion/references/git-visibility.md',
  'skills/porcelain-companion/agents/openai.yaml',
])

const EXPLICIT_POLICY = Object.freeze([
  ['skill describes an explicit product-surface procedure', 'explicit product surface procedure'],
  ['skill forbids automatic Review clearing', 'do not clear another active review automatically'],
  [
    'skill requires human request or deliberate publication',
    'create or clear a review only when the human requests companion work or the agent deliberately publishes a review',
  ],
  [
    'skill leaves ordinary code edits outside Review lifecycle',
    'ordinary code edits follow root agents md do not create clear or complete a review',
  ],
  [
    'skill scopes evidence validation to published Reviews',
    'check evidence mjs before claiming an intentionally published review complete',
  ],
])

const FORBIDDEN_LIFECYCLE = Object.freeze([
  ['mandatory session clear/set lifecycle', /start of session.*review clear.*review set/],
  ['clear-if-previous-unit lifecycle', /review clear if (?:the )?previous unit is done/],
  ['clear-first lifecycle', /review clear first/],
  ['clear-before-new-unit lifecycle', /clear before a new unit/],
  ['clear-before-next-unit lifecycle', /review clear before the next unit/],
  ['always-start-clean lifecycle', /always start clean when beginning a new unit/],
  ['default Review creation', /normally create a review/],
  ['automatic Board-to-Review handoff', /when you pick up a doing card start the review/],
])

const FORBIDDEN_MIGRATION = Object.freeze([
  ['home migration heading', /one way migrate from home/],
  ['home migration copy', /copies? (?:it )?into the repo/],
  ['home migration purge', /purges? the home keys/],
  ['home migration move-back', /there is no move back/],
  ['daemon-config migration', /migrated once from daemon config/],
  ['daemon-config migration startup', /on startup if you had hide pin before this channel existed/],
  ['legacy home-channel migration', /older porcelain stored channels in home/],
])

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function phrase(value) {
  return normalize(value)
}

function hasPhrase(value, expected) {
  return value.includes(phrase(expected))
}

function readSources(root, failures) {
  const sources = new Map()
  for (const relativePath of COMPANION_FOUNDATION_FILES) {
    const absolutePath = path.join(root, relativePath)
    if (!existsSync(absolutePath)) {
      failures.push(`missing authored Companion source ${relativePath}`)
      continue
    }
    sources.set(relativePath, readFileSync(absolutePath, 'utf8'))
  }
  return sources
}

/**
 * Validate the explicit-only policy and removal of deleted migration guidance.
 *
 * The root argument is injectable so fixture tests can prove the gate fails closed without
 * touching the real repository or any `.porcelain` directory.
 */
export function checkCompanionFoundation(root) {
  const failures = []
  const sources = readSources(root, failures)
  const skill = normalize(sources.get('skills/porcelain-companion/SKILL.md') ?? '')
  const review = normalize(sources.get('skills/porcelain-companion/references/review.md') ?? '')
  const board = normalize(sources.get('skills/porcelain-companion/references/board.md') ?? '')
  const syncEnvironments = normalize(
    sources.get('skills/porcelain-companion/references/sync-environments.md') ?? '',
  )
  const scope = normalize(sources.get('skills/porcelain-companion/references/scope.md') ?? '')
  const gitVisibility = normalize(
    sources.get('skills/porcelain-companion/references/git-visibility.md') ?? '',
  )
  const adapter = normalize(sources.get('skills/porcelain-companion/agents/openai.yaml') ?? '')
  const allSources = [...sources.values()].map(normalize).join(' ')

  for (const [label, expected] of EXPLICIT_POLICY) {
    if (!hasPhrase(skill, expected)) failures.push(`${label} is missing from SKILL.md`)
  }

  if (!hasPhrase(review, 'do not clear another active Review automatically')) {
    failures.push('Review reference does not forbid automatic clearing')
  }
  if (!hasPhrase(review, 'explicit replacement')) {
    failures.push('Review reference does not describe explicit replacement')
  }
  if (!hasPhrase(board, 'only when publication is requested')) {
    failures.push('Board reference does not keep Review publication explicit')
  }
  if (!hasPhrase(adapter, 'human requests Companion work or you deliberately publish a Review')) {
    failures.push('OpenAI adapter prompt does not describe explicit publication')
  }
  if (!hasPhrase(syncEnvironments, 'repo local channels deliberately')) {
    failures.push('environment reference does not describe deliberate repo-local sharing')
  }
  if (!hasPhrase(scope, 'current project relative channel')) {
    failures.push('scope reference does not describe the current project-relative channel')
  }
  if (!hasPhrase(gitVisibility, 'current disposable migrated from home marker')) {
    failures.push('git visibility does not explain the retained disposable marker')
  }

  for (const [label, pattern] of FORBIDDEN_LIFECYCLE) {
    if (pattern.test(allSources)) failures.push(`forbidden ${label} wording remains`)
  }

  const migrationSources = [syncEnvironments, scope].join(' ')
  for (const [label, pattern] of FORBIDDEN_MIGRATION) {
    if (pattern.test(migrationSources)) failures.push(`forbidden ${label} wording remains`)
  }

  return failures
}

const root = fileURLToPath(new URL('..', import.meta.url))
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  const failures = checkCompanionFoundation(root)
  if (failures.length > 0) {
    console.error('lint-companion-foundations: failed')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log('lint-companion-foundations: ok — authored Companion is explicit-only')
  }
}
