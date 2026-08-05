#!/usr/bin/env node
// Validate an evidence pack before claiming a unit done.
//
// The Evidence tab renders index.html in a fully sandboxed iframe (sandbox="", no
// allow-scripts) with no Porcelain theme, and refuses to render past a read cap. Every
// failure mode below is silent in the app — an unstyled pack just looks broken, an
// over-cap pack shows a size error instead of the report, and a missing screenshot is a
// blank box. Catching them here is the difference between evidence and a broken page.
//
// Usage:  node check-evidence.mjs [--repo <abs path>]
// Exit:   0 = ready to publish, 1 = problems listed on stdout.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

// The daemon refuses to render an evidence pack past this size, measured AFTER local
// images and stylesheets are inlined as data URIs. Base64 costs ~4 bytes per 3 raw bytes,
// so raw asset bytes are scaled by 4/3 to estimate the rendered document.
const READ_CAP_BYTES = 4 * 1024 * 1024
const BASE64_OVERHEAD = 4 / 3

const INLINED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.css'])

function resolveRepo(argv) {
  const flagIndex = argv.indexOf('--repo')
  if (flagIndex !== -1) {
    const value = argv[flagIndex + 1]
    if (value === undefined || !isAbsolute(value)) {
      console.error('--repo must be an absolute path')
      process.exit(1)
    }
    return value
  }
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  } catch {
    console.error('not inside a git repository — pass --repo <absolute path>')
    process.exit(1)
  }
}

/** Every file under dir, recursively, as paths relative to dir. */
function walk(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, base))
    else out.push(relative(base, full))
  }
  return out
}

function extensionOf(path) {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

/** Local relative refs from src=""/href="" — skips data:, http(s):, protocol-relative, absolute. */
function localRefs(html) {
  const refs = []
  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const ref = match[1]
    if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(ref)) continue
    refs.push(ref.split(/[?#]/)[0])
  }
  return refs
}

const repo = resolveRepo(process.argv.slice(2))
const dir = join(repo, '.porcelain', 'active-review', 'evidence')
const problems = []
const notes = []

if (!existsSync(dir)) {
  console.log(`No evidence directory for ${repo}.`)
  console.log('Run `~/.porcelain/porcelain evidence prepare --title "…"` first.')
  process.exit(1)
}

const indexPath = join(dir, 'index.html')
if (!existsSync(indexPath)) {
  problems.push('index.html is missing — the Report tab has nothing to render.')
  // Everything below reads index.html; without it there is nothing more to say.
  console.log(`Evidence at ${dir}\n`)
  for (const p of problems) console.log(`  FAIL  ${p}`)
  process.exit(1)
}

const html = readFileSync(indexPath, 'utf8')
const files = walk(dir)

// --- CSS: required, because the sandbox applies no Porcelain theme -------------------
const hasInlineStyle = /<style[\s>]/i.test(html)
const linkedStylesheets = localRefs(html).filter((ref) => extensionOf(ref) === '.css')
if (!hasInlineStyle && linkedStylesheets.length === 0) {
  problems.push(
    'No CSS: index.html has neither a <style> block nor a linked local stylesheet. ' +
      'The sandbox applies no theme, so this renders as unstyled markup.',
  )
}

// --- Scripts and remote assets: silently dropped by the sandbox ----------------------
if (/<script[\s>]/i.test(html)) {
  problems.push('index.html contains a <script> tag. Scripts never run (sandbox=""); remove it.')
}
const remote = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/|\/\/)[^"']*["']/gi)]
if (remote.length > 0) {
  problems.push(
    `${remote.length} remote asset reference(s) (http/https). These are blocked — inline them or ` +
      'write them into the evidence directory as local files.',
  )
}
for (const ref of localRefs(html)) {
  if (ref.startsWith('file:')) {
    problems.push(`Absolute file: reference "${ref}" will not load; use a relative path.`)
  }
}

// --- Referenced local files must exist ------------------------------------------------
for (const ref of localRefs(html)) {
  if (!existsSync(join(dir, ref))) {
    problems.push(`index.html references "${ref}", which is not in the evidence directory.`)
  }
}

// --- Size against the read cap --------------------------------------------------------
let inlinedEstimate = Buffer.byteLength(html, 'utf8')
for (const file of files) {
  if (file === 'index.html') continue
  const bytes = statSync(join(dir, file)).size
  inlinedEstimate += INLINED_EXTENSIONS.has(extensionOf(file))
    ? Math.ceil(bytes * BASE64_OVERHEAD)
    : 0
}
const asMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
if (inlinedEstimate > READ_CAP_BYTES) {
  problems.push(
    `Estimated inlined size ${asMb(inlinedEstimate)} exceeds the ${asMb(READ_CAP_BYTES)} read cap. ` +
      'The tab will show a size error instead of the report — shrink screenshots (JPEG/WebP ~540px).',
  )
} else if (inlinedEstimate > READ_CAP_BYTES * 0.8) {
  notes.push(`Size ${asMb(inlinedEstimate)} is close to the ${asMb(READ_CAP_BYTES)} cap.`)
}

// --- Unreferenced assets: usually a typo'd src, so worth surfacing --------------------
const referenced = new Set(localRefs(html))
const orphans = files.filter(
  (file) =>
    file !== 'index.html' &&
    INLINED_EXTENSIONS.has(extensionOf(file)) &&
    !referenced.has(file) &&
    !referenced.has(`./${file}`),
)
if (orphans.length > 0) {
  notes.push(`Not referenced by index.html: ${orphans.join(', ')}`)
}

console.log(`Evidence at ${dir}`)
console.log(`  ${files.length} file(s), ~${asMb(inlinedEstimate)} inlined\n`)
for (const problem of problems) console.log(`  FAIL  ${problem}`)
for (const note of notes) console.log(`  NOTE  ${note}`)
if (problems.length === 0) console.log('  OK    Evidence pack is ready to publish.')

process.exit(problems.length > 0 ? 1 : 0)
