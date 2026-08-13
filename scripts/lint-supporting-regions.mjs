#!/usr/bin/env node
/**
 * SUP-001 — lock web/mobile shell, settings, and viewer production files to public-index
 * composition. Supporting regions may import a domain barrel or a type-only contract; they
 * must not import transport, daemon, @backend, a procedure schema, or a feature internal.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMAIN_KEYS } from './architecture/domains.mjs'

const skippedDirectories = new Set([
  '.stryker-tmp',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
])

const SUPPORTING_ROOTS = [
  'apps/web/src/components/shell',
  'apps/web/src/components/settings',
  'apps/web/src/components/viewer',
  'apps/web/src/lib/responsive-shell.ts',
  'apps/mobile/src/features/shell',
  'apps/mobile/src/features/settings',
]

const TRANSPORT_PREFIXES = [
  '@renderer/lib/trpc',
  '@/lib/trpc',
  'lib/trpc',
  '@renderer/lib/daemon',
  '@/lib/daemon',
  'lib/daemon',
]

const FEATURE_PREFIXES = ['@renderer/features/', '@/features/']
const DOMAIN_KEY_SET = new Set(DOMAIN_KEYS)
const PROCEDURE_SCHEMA = /(Query|Mutation)Schema$/
const CONTRACT_NAMED_IMPORT =
  /(?:^|[;\n])\s*import\s+(type\s+)?(?:[\w*][\w]*\s*,\s*)?\{([^}]*)\}\s+from\s+['"](@porcelain\/contracts(?:\/[^'"]*)?)['"]/gm

function walk(directory, output = []) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, output)
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) output.push(absolute)
  }
  return output
}

function isTestFile(filePath) {
  return /\.(?:test|spec)\.(?:ts|tsx)$/.test(filePath)
}

/** Deterministic textual import/export specifier extraction (same approach as lint-cli-boundary). */
function importSpecifiers(source) {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm)].map(
    (match) => match[1],
  )
}

function isForbiddenTransport(specifier) {
  return TRANSPORT_PREFIXES.some(
    (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
  )
}

function forbiddenDeepDomainImport(specifier) {
  for (const prefix of FEATURE_PREFIXES) {
    if (!specifier.startsWith(prefix)) continue
    const rest = specifier.slice(prefix.length)
    const slash = rest.indexOf('/')
    if (slash === -1) return null
    const domain = rest.slice(0, slash)
    const remainder = rest.slice(slash + 1)
    if (DOMAIN_KEY_SET.has(domain) && remainder !== 'index' && remainder !== 'index.ts') {
      return specifier
    }
  }
  return null
}

function forbiddenProcedureSchemas(source) {
  const hits = []
  for (const match of source.matchAll(CONTRACT_NAMED_IMPORT)) {
    if (match[1]) continue
    const specifier = match[3]
    for (const raw of match[2].split(',')) {
      const part = raw.trim()
      if (part.length === 0 || /^type\s/.test(part)) continue
      const name = part.replace(/\s+as\s+\S+$/, '').trim()
      if (PROCEDURE_SCHEMA.test(name)) hits.push({ name, specifier })
    }
  }
  return hits
}

function collectProductionFiles(root) {
  const files = []
  for (const relativeRoot of SUPPORTING_ROOTS) {
    const absolute = path.join(root, ...relativeRoot.split('/'))
    if (!existsSync(absolute)) continue
    const stat = statSync(absolute)
    if (stat.isFile()) {
      if (/\.(?:ts|tsx)$/.test(absolute) && !isTestFile(absolute)) files.push(absolute)
      continue
    }
    for (const file of walk(absolute)) {
      if (!isTestFile(file)) files.push(file)
    }
  }
  return files
}

/**
 * @param {string} root repository root
 * @returns {string[]} violation messages (empty when clean)
 */
export function checkSupportingRegions(root) {
  const failures = []
  const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/')

  for (const absolute of collectProductionFiles(root)) {
    const file = relative(absolute)
    const source = readFileSync(absolute, 'utf8')

    for (const specifier of importSpecifiers(source)) {
      if (isForbiddenTransport(specifier)) {
        failures.push(`${file} imports forbidden transport: ${specifier}`)
        continue
      }
      if (specifier === '@backend' || specifier.startsWith('@backend/')) {
        failures.push(`${file} imports forbidden @backend specifier: ${specifier}`)
        continue
      }
      const deep = forbiddenDeepDomainImport(specifier)
      if (deep !== null) {
        failures.push(`${file} imports deep canonical-domain feature: ${deep}`)
      }
    }

    for (const { name, specifier } of forbiddenProcedureSchemas(source)) {
      failures.push(`${file} imports forbidden contract procedure schema ${name} from ${specifier}`)
    }
  }

  return failures
}

function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const failures = checkSupportingRegions(root)

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure)
    process.exit(1)
  }

  console.log(
    'lint-supporting-regions: ok — supporting production files compose public indexes only',
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
