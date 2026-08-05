#!/usr/bin/env node
/**
 * Keep every workspace package version — and the shipped skill — identical.
 *
 * Canonical stamp: apps/desktop/package.json until apps/daemon owns the product
 * version (architecture charter). Discover every package.json under apps/ and
 * packages/ that already has a `version` field and write the same string, then
 * stamp the same version into each shipped SKILL.md's frontmatter.
 *
 * Usage:
 *   node scripts/sync-versions.mjs              # sync to canonical
 *   node scripts/sync-versions.mjs --check      # exit 1 if any drift
 *   node scripts/sync-versions.mjs --set 1.2.3  # write explicit version everywhere
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
// Prefer daemon when it exists and carries a version; else desktop (electron-builder today).
const CANONICAL_CANDIDATES = [
  join(root, 'apps', 'daemon', 'package.json'),
  join(root, 'apps', 'desktop', 'package.json'),
]

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    set: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help) {
  console.log(`Usage: node scripts/sync-versions.mjs [--check] [--set X.Y.Z]
One product version across all workspace packages (see .agents/reference/architecture.md).`)
  process.exit(0)
}

function listPackageJsonFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'out' || name.startsWith('.'))
      continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) listPackageJsonFiles(full, out)
    else if (name === 'package.json') out.push(full)
  }
  return out
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Shipped agent skills carry the product version in their SKILL.md frontmatter: the skill is
 * distributed with the app (`npx skills add`), and the app reports SKILLS_VERSION to prompt an
 * upgrade, so a skill version that drifts from the app is a lie the human acts on.
 */
const SKILL_FILES = [
  join(root, 'skills', 'porcelain-companion', 'SKILL.md'),
  // Skills we author. Listed explicitly, never globbed: .agents/skills also holds vendored
  // Expo skills that carry their own upstream version, and restamping those would claim we
  // ship an upstream release we do not have.
  ...['ship', 'audit', 'mobile', 'releasing'].map((name) =>
    join(root, '.agents', 'skills', name, 'SKILL.md'),
  ),
]

/** Replace `version:` inside the leading `---` frontmatter block only. */
function stampSkillVersion(path, next) {
  const text = readFileSync(path, 'utf8')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!frontmatter) return { changed: false, current: null }
  const current = /^version:[ \t]*(.+)$/m.exec(frontmatter[1])?.[1]?.trim() ?? null
  if (current === next) return { changed: false, current }
  const updated =
    current === null
      ? // New field: sit right after `name:` so frontmatter reads name → version → rest.
        text.replace(/^(---\r?\n[\s\S]*?^name:.*$)/m, `$1\nversion: ${next}`)
      : text.replace(/^---\r?\n[\s\S]*?\r?\n---/, (block) =>
          block.replace(/^version:[ \t]*.+$/m, `version: ${next}`),
        )
  writeFileSync(path, updated)
  return { changed: true, current }
}

function resolveCanonicalPath() {
  for (const path of CANONICAL_CANDIDATES) {
    if (!existsSync(path)) continue
    const pkg = readJson(path)
    if (typeof pkg.version === 'string' && pkg.version.length > 0) return path
  }
  console.error('[sync-versions] no canonical package.json with a version field')
  process.exit(1)
}

const packageFiles = [
  ...listPackageJsonFiles(join(root, 'apps')),
  ...listPackageJsonFiles(join(root, 'packages')),
].filter((path) => {
  const pkg = readJson(path)
  return typeof pkg.version === 'string'
})

const canonicalPath = resolveCanonicalPath()
const version = values.set ?? readJson(canonicalPath).version

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`[sync-versions] invalid version: ${version}`)
  process.exit(1)
}

let drifted = 0
for (const path of packageFiles) {
  const pkg = readJson(path)
  const rel = relative(root, path)
  if (pkg.version === version) continue
  drifted++
  if (values.check) {
    console.error(`[sync-versions] drift: ${rel} has ${pkg.version}, expected ${version}`)
    continue
  }
  pkg.version = version
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`[sync-versions] ${rel} → ${version}`)
}

for (const path of SKILL_FILES) {
  if (!existsSync(path)) continue
  const rel = relative(root, path)
  if (values.check) {
    const text = readFileSync(path, 'utf8')
    const current = /^---\r?\n[\s\S]*?^version:[ \t]*(.+)$/m.exec(text)?.[1]?.trim() ?? null
    if (current === version) continue
    drifted++
    console.error(
      `[sync-versions] drift: ${rel} has ${current ?? 'no version'}, expected ${version}`,
    )
    continue
  }
  const { changed, current } = stampSkillVersion(path, version)
  if (changed) console.log(`[sync-versions] ${rel} ${current ?? 'unset'} → ${version}`)
}

if (values.check) {
  if (drifted > 0) {
    console.error(
      `[sync-versions] ${drifted} file(s) out of sync (canonical ${relative(root, canonicalPath)} = ${version})`,
    )
    process.exit(1)
  }
  console.log(
    `[sync-versions] ok — ${packageFiles.length} package(s) + ${SKILL_FILES.length} skill(s) at ${version}`,
  )
  process.exit(0)
}

if (drifted === 0 && !values.set) {
  console.log(`[sync-versions] already aligned — ${packageFiles.length} package(s) at ${version}`)
} else if (values.set) {
  // --set must write even when already matching (no-op ok), and re-write canonical
  for (const path of packageFiles) {
    const pkg = readJson(path)
    if (pkg.version === version) continue
    pkg.version = version
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
  }
  console.log(`[sync-versions] set ${version} on ${packageFiles.length} package(s)`)
}
