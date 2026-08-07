#!/usr/bin/env node
// Validate an evidence pack before claiming a unit done.
//
// Evidence is three parts under `.porcelain/active-review/evidence/`: structured checks
// (`meta.json`), a Results document set (`results/*.md|*.html`), and an image gallery
// (`assets/`). Results HTML renders in a fully sandboxed iframe (sandbox="", no
// allow-scripts) with no Porcelain theme, and the daemon refuses to render past its caps.
// Every failure mode below is silent in the app — an unstyled document just looks broken,
// an over-cap one is dropped from the tabs, and a missing screenshot is a blank box.
// Catching them here is the difference between evidence and a broken page.
//
// A pack written before Evidence had sub-tabs (a lone root `index.html`) still validates,
// and still passes.
//
// Usage:  node check-evidence.mjs [--repo <abs path>]
// Exit:   0 = ready to publish, 1 = problems listed on stdout.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

// Lockstep with apps/daemon/src/review/doc-set.ts (the Results set) and
// apps/daemon/src/stores/evidence-store.ts (the legacy single report). Base64 costs ~4
// bytes per 3 raw bytes, so raw asset bytes are scaled by 4/3 to estimate the rendered doc.
const MAX_DOC_BYTES = 2 * 1024 * 1024
const MAX_TOTAL_BYTES = 8 * 1024 * 1024
const LEGACY_READ_CAP_BYTES = 4 * 1024 * 1024
const BASE64_OVERHEAD = 4 / 3

// Lockstep with apps/daemon/src/review/evidence-assets-list.ts.
const MAX_ASSETS = 60
const MAX_ASSET_BYTES = 8 * 1024 * 1024

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.ico',
  '.bmp',
  '.avif',
])
const INLINED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, '.css'])
const DOC_EXTENSIONS = new Set(['.md', '.markdown', '.html', '.htm'])

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
  if (!existsSync(dir)) return []
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
  // Markdown images too: a Results `.md` referencing ../assets/shot.png fails just as silently.
  for (const match of html.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    const ref = match[1]
    if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(ref)) continue
    refs.push(ref.split(/[?#]/)[0])
  }
  return refs
}

const repo = resolveRepo(process.argv.slice(2))
const dir = join(repo, '.porcelain', 'active-review', 'evidence')
const resultsDir = join(dir, 'results')
const assetsDir = join(dir, 'assets')
const problems = []
const notes = []

if (!existsSync(dir)) {
  console.log(`No evidence directory for ${repo}.`)
  console.log('Run `~/.porcelain/porcelain evidence prepare --title "…"` first.')
  process.exit(1)
}

// --- Checks: the sub-tab a human reads first -----------------------------------------
let checks = []
try {
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  if (Array.isArray(meta.checks)) checks = meta.checks
} catch {
  // no meta yet — reported as "no checks" below
}
if (checks.length === 0) {
  notes.push('No checks recorded — `evidence check --label … --status pass|fail|skip`.')
}

// --- The documents: results/, plus a legacy root index.html --------------------------
const documents = []
for (const file of walk(resultsDir)) {
  if (!file.includes('/') && DOC_EXTENSIONS.has(extensionOf(file))) {
    documents.push({ label: `results/${file}`, path: join(resultsDir, file), dir: resultsDir })
  }
}
const legacyIndex = join(dir, 'index.html')
if (existsSync(legacyIndex)) {
  documents.push({ label: 'index.html', path: legacyIndex, dir, legacy: true })
}

// --- The gallery ----------------------------------------------------------------------
const galleryFiles = walk(assetsDir).filter((file) => !file.includes('/'))
const galleryImages = galleryFiles.filter((file) => IMAGE_EXTENSIONS.has(extensionOf(file)))
for (const file of galleryFiles) {
  if (!IMAGE_EXTENSIONS.has(extensionOf(file))) {
    notes.push(`assets/${file} is not an image — the gallery skips it.`)
    continue
  }
  const bytes = statSync(join(assetsDir, file)).size
  if (bytes > MAX_ASSET_BYTES) {
    problems.push(
      `assets/${file} is ${asMb(bytes)}, over the ${asMb(MAX_ASSET_BYTES)} per-image cap — ` +
        'it lists in the gallery but will not load. Shrink it (JPEG/WebP ~540px).',
    )
  }
}
if (galleryImages.length > MAX_ASSETS) {
  problems.push(
    `${galleryImages.length} images in assets/, over the ${MAX_ASSETS}-image gallery cap — ` +
      'the tail is not shown. Drop the ones that prove nothing.',
  )
}

if (documents.length === 0 && galleryImages.length === 0) {
  problems.push(
    'Empty pack: no documents in results/ and no images in assets/. Write the proof — ' +
      'a Results document, a screenshot, or both.',
  )
}

// --- Per-document rules ---------------------------------------------------------------
let inlinedEstimate = 0
for (const doc of documents) {
  const body = readFileSync(doc.path, 'utf8')
  const isHtml = extensionOf(doc.path) === '.html' || extensionOf(doc.path) === '.htm'
  const rawBytes = statSync(doc.path).size
  if (rawBytes > MAX_DOC_BYTES) {
    problems.push(
      `${doc.label} is ${asMb(rawBytes)}, over the ${asMb(MAX_DOC_BYTES)} per-document cap — ` +
        'it is dropped from the tabs entirely.',
    )
  }

  if (isHtml) {
    // CSS is required, because the sandbox applies no Porcelain theme.
    const hasInlineStyle = /<style[\s>]/i.test(body)
    const linkedStylesheets = localRefs(body).filter((ref) => extensionOf(ref) === '.css')
    if (!hasInlineStyle && linkedStylesheets.length === 0) {
      problems.push(
        `${doc.label} has neither a <style> block nor a linked local stylesheet. ` +
          'The sandbox applies no theme, so this renders as unstyled markup.',
      )
    }
    if (/<script[\s>]/i.test(body)) {
      problems.push(
        `${doc.label} contains a <script> tag. Scripts never run (sandbox=""); remove it.`,
      )
    }
  }

  const remote = [...body.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/|\/\/)[^"']*["']/gi)]
  if (remote.length > 0) {
    problems.push(
      `${doc.label}: ${remote.length} remote asset reference(s) (http/https). These are blocked — ` +
        'inline them or write them into the evidence directory as local files.',
    )
  }

  let docBytes = Buffer.byteLength(body, 'utf8')
  for (const ref of localRefs(body)) {
    if (ref.startsWith('file:')) {
      problems.push(
        `${doc.label}: absolute file: reference "${ref}" will not load; use a relative path.`,
      )
      continue
    }
    // Refs resolve from the document's own directory and must stay inside the pack —
    // exactly what the daemon does, and how `../assets/shot.png` is meant to work.
    const target = resolve(doc.dir, ref)
    const rel = relative(dir, target)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      problems.push(
        `${doc.label} references "${ref}", which resolves outside the evidence directory. ` +
          'It will not be inlined.',
      )
      continue
    }
    if (!existsSync(target)) {
      problems.push(`${doc.label} references "${ref}", which is not in the evidence directory.`)
      continue
    }
    if (INLINED_EXTENSIONS.has(extensionOf(ref))) {
      docBytes += Math.ceil(statSync(target).size * BASE64_OVERHEAD)
    }
  }
  inlinedEstimate += docBytes

  if (doc.legacy && docBytes > LEGACY_READ_CAP_BYTES) {
    problems.push(
      `${doc.label} inlines to ~${asMb(docBytes)}, over the ${asMb(LEGACY_READ_CAP_BYTES)} legacy ` +
        'report cap. The tab shows a size error instead of the report — shrink the screenshots, ' +
        'or move the pack to results/ + assets/.',
    )
  }
}

function asMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

if (inlinedEstimate > MAX_TOTAL_BYTES) {
  problems.push(
    `Documents inline to ~${asMb(inlinedEstimate)}, over the ${asMb(MAX_TOTAL_BYTES)} total — ` +
      'the tail is dropped. Shrink screenshots (JPEG/WebP ~540px) or move them to the gallery.',
  )
} else if (inlinedEstimate > MAX_TOTAL_BYTES * 0.8) {
  notes.push(
    `Documents inline to ~${asMb(inlinedEstimate)}, close to the ${asMb(MAX_TOTAL_BYTES)} total.`,
  )
}

// --- Unreferenced files beside the documents: usually a typo'd src --------------------
const referenced = new Set()
for (const doc of documents) {
  for (const ref of localRefs(readFileSync(doc.path, 'utf8'))) {
    referenced.add(resolve(doc.dir, ref))
  }
}
const orphans = walk(resultsDir).filter(
  (file) => INLINED_EXTENSIONS.has(extensionOf(file)) && !referenced.has(resolve(resultsDir, file)),
)
if (orphans.length > 0) {
  notes.push(`In results/ but referenced by no document: ${orphans.join(', ')}`)
}

console.log(`Evidence at ${dir}`)
console.log(
  `  ${checks.length} check(s), ${documents.length} document(s) ~${asMb(inlinedEstimate)} inlined, ` +
    `${galleryImages.length} gallery image(s)\n`,
)
for (const problem of problems) console.log(`  FAIL  ${problem}`)
for (const note of notes) console.log(`  NOTE  ${note}`)
if (problems.length === 0) console.log('  OK    Evidence pack is ready to publish.')

process.exit(problems.length > 0 ? 1 : 0)
