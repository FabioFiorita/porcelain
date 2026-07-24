#!/usr/bin/env node
/**
 * Atomic GitHub Release assemble step.
 *
 * Creates (or updates) a non-draft release for the given tag, uploads every
 * file in the provided asset directories, marks it as latest, and optionally
 * deletes other leftover draft releases from failed past attempts.
 *
 * Usage:
 *   node scripts/release-publish.mjs --tag v0.40.0 --title "Porcelain 0.40.0" \
 *     --assets dist-mac --assets dist-linux
 *   node scripts/release-publish.mjs --tag v0.40.0 --assets dist-mac --cleanup-drafts
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    tag: { type: 'string' },
    title: { type: 'string' },
    target: { type: 'string' },
    assets: { type: 'string', multiple: true, default: [] },
    'cleanup-drafts': { type: 'boolean', default: false },
    notes: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help || !values.tag) {
  console.log(`Usage: node scripts/release-publish.mjs --tag vX.Y.Z [--title T] [--target SHA|branch] \\
  --assets dir [--assets dir2] [--cleanup-drafts] [--notes file]`)
  process.exit(values.help ? 0 : 1)
}

const tag = values.tag
const title = values.title ?? `Porcelain ${tag.replace(/^v/, '')}`
const target = values.target

function sh(cmd, args, opts = {}) {
  const out = execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      CLICOLOR: '0',
      GH_FORCE_TTY: '0',
    },
    ...opts,
  })
  // inherit returns null; callers that need text always use pipe mode.
  return typeof out === 'string' ? out.trim() : out
}

function releaseExists(t) {
  try {
    sh('gh', ['release', 'view', t])
    return true
  } catch {
    return false
  }
}

/** Collect files to upload (skip directories and empty paths). */
function collectFiles(dirs) {
  const files = []
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) {
      console.error(`release:publish ✗ assets dir missing: ${dir}`)
      process.exit(1)
    }
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name)
      if (fs.statSync(full).isFile()) {
        files.push(full)
      }
    }
  }
  return files
}

const assetDirs = values.assets ?? []
const files = collectFiles(assetDirs)
if (files.length === 0) {
  console.error('release:publish ✗ no asset files found to upload')
  process.exit(1)
}

console.log(`release:publish → ${tag} (${files.length} assets)`)

const notesArgs = values.notes ? ['--notes-file', values.notes] : ['--generate-notes']

if (!releaseExists(tag)) {
  // Published immediately (not draft). electron-updater only sees non-drafts.
  // --target pins the tag to the release commit (pending branch SHA) so we can
  // create the release *before* merging to main; that avoids a tag-push race
  // that would re-trigger this workflow against an empty release.
  const targetArgs = target ? ['--target', target] : []
  sh(
    'gh',
    ['release', 'create', tag, '--title', title, '--latest', ...targetArgs, ...notesArgs, ...files],
    { inherit: true },
  )
} else {
  // Idempotent re-publish / retry path: undraft, mark latest, re-upload.
  sh('gh', ['release', 'edit', tag, '--draft=false', '--latest', '--title', title], {
    inherit: true,
  })
  sh('gh', ['release', 'upload', tag, ...files, '--clobber'], { inherit: true })
}

// Confirm non-draft + assets. (isLatest is not on all gh CLI versions' --json
// field set — Actions runners often ship an older gh — so use the REST "latest"
// endpoint instead of `gh release view --json isLatest`.)
const meta = JSON.parse(sh('gh', ['release', 'view', tag, '--json', 'isDraft,assets,url']))
if (meta.isDraft) {
  console.error('release:publish ✗ release is still draft after publish')
  process.exit(1)
}
if (!meta.assets?.length) {
  console.error('release:publish ✗ release has no assets')
  process.exit(1)
}
let latestTag = ''
try {
  latestTag = sh('gh', [
    'api',
    `repos/${process.env.GITHUB_REPOSITORY ?? 'FabioFiorita/porcelain'}/releases/latest`,
    '--jq',
    '.tag_name',
  ])
} catch {
  // no "latest" release yet
}
if (latestTag && latestTag !== tag) {
  console.error(`release:publish ✗ latest is ${latestTag}, expected ${tag}`)
  process.exit(1)
}
console.log(
  `release:publish ✓ ${meta.url} (${meta.assets.length} assets${latestTag === tag ? ', latest' : ''})`,
)

if (values['cleanup-drafts']) {
  /** @type {Array<{ tagName: string, isDraft: boolean }>} */
  const list = JSON.parse(
    sh('gh', ['release', 'list', '--limit', '50', '--json', 'tagName,isDraft']),
  )
  for (const r of list) {
    if (!r.isDraft || r.tagName === tag) continue
    console.log(`release:publish → deleting leftover draft ${r.tagName}`)
    try {
      // Keep the git tag (policy: never rewrite tags); only drop the draft release.
      sh('gh', ['release', 'delete', r.tagName, '--yes'], { inherit: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`release:publish ⚠ could not delete draft ${r.tagName}: ${msg}`)
    }
  }
}
