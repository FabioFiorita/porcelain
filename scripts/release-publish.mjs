#!/usr/bin/env node
/** Upload and verify release assets before publishing an existing tag. */
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function collectFiles(dirs) {
  const files = dirs.flatMap((dir) =>
    readdirSync(dir)
      .map((name) => join(dir, name))
      .filter((file) => statSync(file).isFile()),
  )
  if (!files.length) throw new Error('No release assets found')
  if (new Set(files.map((file) => basename(file))).size !== files.length) {
    throw new Error('Release asset names must be unique across directories')
  }
  return files
}

export function publishRelease(
  { tag, title = `Porcelain ${tag.replace(/^v/, '')}`, assets, notes },
  run = sh,
) {
  const files = collectFiles(assets)
  // Only a successful query with no matching tag permits creating a new draft.
  const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
  const releases = JSON.parse(
    run('gh', ['api', '--paginate', '--slurp', `repos/${repo}/releases`]),
  ).flat()
  if (!releases.some((release) => release.tag_name === tag)) {
    run('gh', [
      'release',
      'create',
      tag,
      '--draft',
      '--verify-tag',
      '--title',
      title,
      ...(notes ? ['--notes-file', notes] : ['--generate-notes']),
    ])
  }
  run('gh', ['release', 'upload', tag, ...files, '--clobber'])
  const readRelease = () =>
    JSON.parse(run('gh', ['release', 'view', tag, '--json', 'isDraft,assets,url']))
  const uploaded = readRelease()
  for (const file of files) {
    const asset = uploaded.assets.find((entry) => entry.name === basename(file))
    if (!asset || asset.size !== statSync(file).size) {
      throw new Error(`Release asset missing or incomplete: ${basename(file)}`)
    }
  }
  run('gh', ['release', 'edit', tag, '--draft=false', '--latest', '--title', title])
  const published = readRelease()
  if (published.isDraft) throw new Error('Release is still a draft')
  const latest = run('gh', ['api', `repos/${repo}/releases/latest`, '--jq', '.tag_name'])
  if (latest !== tag) throw new Error(`Latest release is ${latest}, expected ${tag}`)
  console.log(`release:publish ✓ ${published.url} (${files.length} verified assets)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      tag: { type: 'string' },
      title: { type: 'string' },
      assets: { type: 'string', multiple: true, default: [] },
      notes: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
  })
  if (values.help || !values.tag) {
    console.log(
      'Usage: node scripts/release-publish.mjs --tag vX.Y.Z --assets dir [--assets dir2] [--title T] [--notes file]',
    )
    process.exit(values.help ? 0 : 1)
  }
  publishRelease(values)
}
