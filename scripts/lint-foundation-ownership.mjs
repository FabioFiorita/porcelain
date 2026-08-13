#!/usr/bin/env node
/**
 * AGT-001 — keep the Ship/Audit ownership map complete before either legacy foundation is removed.
 *
 * This checker owns the index shape only. It does not import lint-audit.mjs and therefore cannot
 * disappear or weaken when AGT-003 retires the generic Audit router.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SHIP_IDS = Object.freeze([
  'SHIP-01',
  'SHIP-02',
  'SHIP-03',
  'SHIP-04',
  'SHIP-05',
  'SHIP-06',
  'SHIP-07',
  'SHIP-08',
  'SHIP-09',
  'SHIP-10',
  'SHIP-11',
])

export const AUDIT_IDS = Object.freeze([
  'AUD-01',
  'AUD-02',
  'AUD-03',
  'AUD-04',
  'AUD-05',
  'AUD-06',
  'AUD-07',
  'AUD-08',
  'AUD-09',
  'AUD-10',
  'AUD-11',
  'AUD-12',
  'AUD-13',
  'AUD-14',
  'AUD-15',
  'AUD-16',
  'AUD-17',
  'AUD-18',
])

export const ALL_IDS = Object.freeze([...SHIP_IDS, ...AUDIT_IDS])

const MAP_RELATIVE_PATH = 'docs/internals/agent-foundations.md'
const TABLE_HEADER =
  '| ID | Legacy source | Current owner | Permanent source | Proof | Gate | Status |'
const REQUIRED_SECTIONS = Object.freeze(['Ship responsibility map', 'Audit invariant map'])
const RETIRED_SOURCE_PATTERNS = [
  '.agents/skills/ship',
  '.agents/skills/audit',
  'docs/internals/audit',
]
const PLACEHOLDER_PATTERN = /\b(?:TBD|TODO|to be decided|as appropriate|tested elsewhere)\b/i
const COMMAND_PATTERN = /\b(?:pnpm|node|git|husky)\b/

function splitTableRow(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparatorRow(cells) {
  return cells !== null && cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function tableRows(markdown, section, requiredSections) {
  const lines = markdown.split('\n')
  const heading = `## ${section}`
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) {
    if (requiredSections.includes(section)) return { rows: [], failures: [`missing “${heading}”`] }
    return { rows: [], failures: [] }
  }

  const failures = []
  let headerIndex = -1
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line.startsWith('## ')) break
    if (line === TABLE_HEADER) {
      headerIndex = index
      break
    }
  }
  if (headerIndex === -1) {
    failures.push(`${section}: missing exact ownership table header`)
    return { rows: [], failures }
  }

  const rows = []
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line.startsWith('## ')) break
    if (line === '') {
      if (rows.length > 0) break
      continue
    }
    const cells = splitTableRow(line)
    if (cells === null) {
      if (rows.length > 0) break
      continue
    }
    if (isSeparatorRow(cells)) continue
    rows.push({ cells, line: index + 1 })
  }
  return { rows, failures }
}

function markdownLinks(cell) {
  return [...cell.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1])
}

function checkLinkTargets(cell, mapPath, label, failures) {
  for (const rawTarget of markdownLinks(cell)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(rawTarget)) continue
    const target = rawTarget.split(/[?#]/, 1)[0]
    const absolute = path.resolve(path.dirname(mapPath), target)
    if (!existsSync(absolute)) {
      failures.push(`${label} links to missing path ${target}`)
    }
  }
}

function sourceUsesRetiredFoundation(cell) {
  const lower = cell.toLowerCase()
  return RETIRED_SOURCE_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Parse and validate an ownership map.
 *
 * The reduced expected-ID/section options are intentionally exported for fixture tests; production
 * checkFoundationOwnership() always supplies all 29 IDs and both sections.
 *
 * @param {string} markdown
 * @param {string} root repository or fixture root
 * @param {{ mapPath?: string, requiredIds?: readonly string[], requiredSections?: readonly string[] }} options
 * @returns {string[]} violation messages
 */
export function checkOwnershipMap(markdown, root, options = {}) {
  const mapPath = options.mapPath ?? path.join(root, MAP_RELATIVE_PATH)
  const requiredIds = options.requiredIds ?? ALL_IDS
  const requiredSections = options.requiredSections ?? REQUIRED_SECTIONS
  const failures = []
  const rows = []

  for (const section of requiredSections) {
    const parsed = tableRows(markdown, section, requiredSections)
    failures.push(...parsed.failures.map((failure) => `${section}: ${failure}`))
    rows.push(...parsed.rows)
  }

  const byId = new Map()
  for (const row of rows) {
    if (row.cells.length !== 7) {
      failures.push(`line ${row.line}: ownership row must have 7 cells (found ${row.cells.length})`)
      continue
    }
    const id = row.cells[0].replaceAll('`', '')
    if (byId.has(id)) {
      failures.push(`${id}: duplicate ownership row (lines ${byId.get(id).line} and ${row.line})`)
      continue
    }
    byId.set(id, row)
  }

  const expected = new Set(requiredIds)
  for (const id of requiredIds) {
    if (!byId.has(id)) failures.push(`${id}: missing ownership row`)
  }
  for (const id of byId.keys()) {
    if (!expected.has(id)) failures.push(`${id}: unexpected ownership row`)
  }

  for (const id of requiredIds) {
    const row = byId.get(id)
    if (!row) continue
    const [rowId, legacySource, owner, permanentSource, proof, gate, status] = row.cells
    const fields = [
      ['legacy source', legacySource],
      ['current owner', owner],
      ['permanent source', permanentSource],
      ['proof', proof],
      ['gate', gate],
      ['status', status],
    ]
    for (const [name, value] of fields) {
      if (value === '') failures.push(`${id}: missing ${name} at line ${row.line}`)
      if (PLACEHOLDER_PATTERN.test(value)) {
        failures.push(`${id}: ${name} contains placeholder language at line ${row.line}`)
      }
    }
    if (rowId.replaceAll('`', '') !== id) {
      failures.push(`${id}: row identifier drift at line ${row.line}`)
    }
    if (status.toLowerCase() !== 'complete') {
      failures.push(`${id}: status must be Complete before foundation removal`)
    }
    if (!COMMAND_PATTERN.test(gate)) {
      failures.push(`${id}: gate must name an executable command at line ${row.line}`)
    }
    if (markdownLinks(proof).length === 0 && !COMMAND_PATTERN.test(proof)) {
      failures.push(`${id}: proof must name a linked proof path or command at line ${row.line}`)
    }
    checkLinkTargets(permanentSource, mapPath, `${id} permanent source`, failures)
    checkLinkTargets(proof, mapPath, `${id} proof`, failures)
    if (status.toLowerCase() === 'complete') {
      if (sourceUsesRetiredFoundation(permanentSource)) {
        failures.push(`${id}: Complete permanent source still relies on Ship/Audit material`)
      }
      if (sourceUsesRetiredFoundation(proof)) {
        failures.push(`${id}: Complete proof still relies on Ship/Audit material`)
      }
    }
  }

  return failures
}

/** @param {string} root repository root */
export function checkFoundationOwnership(root) {
  const mapPath = path.join(root, MAP_RELATIVE_PATH)
  if (!existsSync(mapPath)) return [`${MAP_RELATIVE_PATH} is missing`]
  return checkOwnershipMap(readFileSync(mapPath, 'utf8'), root, {
    mapPath,
    requiredIds: ALL_IDS,
    requiredSections: REQUIRED_SECTIONS,
  })
}

function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const failures = checkFoundationOwnership(root)
  if (failures.length > 0) {
    console.error('Foundation ownership drift:\n')
    for (const failure of failures) console.error(`  ${failure}`)
    console.error('\nEvery Ship/Audit row needs one current owner, proof, and executable gate.')
    process.exit(1)
  }
  console.log(`lint-foundation-ownership: ok — ${ALL_IDS.length} current owner rows indexed`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
