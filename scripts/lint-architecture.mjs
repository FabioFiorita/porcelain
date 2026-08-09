#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARCHITECTURE_LINE_CEILING,
  DOMAIN_KEYS,
  DOMAIN_STATUS,
  LEGACY_FEATURE_DIRECTORIES,
  LEGACY_FOUNDATION_APP_IMPORTS,
  OVERSIZED_PRODUCTION_FILES,
  SUPPORTING_REGIONS,
  TARGET_DOMAIN_ROOTS,
  WEB_SERVER_IMPORT_BASELINE,
} from './architecture/domains.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const productionRoots = ['apps', 'packages'].map((entry) => path.join(root, entry))
const skippedDirectories = new Set(['node_modules', 'out', 'dist', 'build', 'coverage', '.expo'])
const genericFeatureFiles = new Set([
  'common.ts',
  'constants.ts',
  'helpers.ts',
  'manager.ts',
  'service.ts',
  'types.ts',
  'utils.ts',
])

function walk(directory, output = []) {
  if (!statSync(directory).isDirectory()) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, output)
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) output.push(absolute)
  }
  return output
}

function relative(absolute) {
  return path.relative(root, absolute).split(path.sep).join('/')
}

function lineCount(source) {
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0)
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm)].map(
    (match) => match[1],
  )
}

function fail(message) {
  failures.push(message)
}

const uniqueDomainKeys = new Set(DOMAIN_KEYS)
if (
  uniqueDomainKeys.size !== 10 ||
  Object.keys(DOMAIN_STATUS).sort().join() !== [...DOMAIN_KEYS].sort().join()
) {
  fail('scripts/architecture/domains.mjs must define exactly one status for each of ten domains')
}
for (const status of Object.values(DOMAIN_STATUS)) {
  if (!['legacy', 'migrating', 'complete'].includes(status)) {
    fail(`unknown domain migration status: ${status}`)
  }
}
if (SUPPORTING_REGIONS.some((region) => uniqueDomainKeys.has(region))) {
  fail('a supporting region is also registered as a product domain')
}

const sourceFiles = productionRoots.flatMap((directory) => walk(directory))
let rawWebServerImportOccurrences = 0
const rawWebServerImportFiles = new Set()

for (const absolute of sourceFiles) {
  const file = relative(absolute)
  const source = readFileSync(absolute, 'utf8')
  const specifiers = importSpecifiers(source)

  if (file.startsWith('packages/contracts/src/') || file.startsWith('packages/shared/src/')) {
    for (const specifier of specifiers) {
      if (
        specifier.includes('/apps/') ||
        specifier.startsWith('apps/') ||
        specifier.startsWith('@backend/') ||
        specifier.startsWith('@renderer/') ||
        specifier.startsWith('@main/') ||
        specifier.startsWith('@porcelain/client-runtime')
      ) {
        const legacyKey = `${file}:${specifier}`
        if (!LEGACY_FOUNDATION_APP_IMPORTS.has(legacyKey)) {
          fail(`${file} crosses from a foundation package into an application: ${specifier}`)
        }
      }
    }
  }

  if (file.startsWith('packages/client-runtime/src/')) {
    for (const specifier of specifiers) {
      if (
        specifier.includes('/apps/') ||
        specifier.startsWith('apps/') ||
        specifier.startsWith('@backend/') ||
        specifier.startsWith('@renderer/') ||
        specifier.startsWith('@main/') ||
        specifier.startsWith('react') ||
        specifier.startsWith('react-native') ||
        specifier === 'electron'
      ) {
        fail(`${file} gives client-runtime an app or platform dependency: ${specifier}`)
      }
    }
  }

  if (file.startsWith('apps/daemon/src/')) {
    for (const specifier of specifiers) {
      if (
        specifier.startsWith('@renderer/') ||
        specifier.startsWith('@main/') ||
        specifier.startsWith('@porcelain/client-runtime') ||
        specifier.includes('/apps/web/') ||
        specifier.includes('/apps/mobile/') ||
        specifier.includes('/apps/desktop/') ||
        specifier.startsWith('react') ||
        specifier.startsWith('react-native') ||
        specifier === 'electron'
      ) {
        fail(`${file} gives the daemon a client or shell dependency: ${specifier}`)
      }
    }
  }

  if (file.startsWith('apps/mobile/src/') || file.startsWith('apps/web/src/')) {
    for (const specifier of specifiers) {
      const otherClient = file.startsWith('apps/mobile/') ? '/apps/web/' : '/apps/mobile/'
      if (specifier.includes(otherClient)) {
        fail(`${file} imports the other client application: ${specifier}`)
      }
    }
  }

  if (file.startsWith('apps/web/src/')) {
    const hits = specifiers.filter(
      (specifier) => specifier.startsWith('@backend/') || specifier.startsWith('@main/'),
    ).length
    if (hits > 0) {
      rawWebServerImportOccurrences += hits
      rawWebServerImportFiles.add(file)
    }
  }

  const inTargetDomain = TARGET_DOMAIN_ROOTS.some((domainRoot) => file.startsWith(`${domainRoot}/`))
  if (inTargetDomain && genericFeatureFiles.has(path.basename(file))) {
    fail(`${file} uses a generic feature filename; name the owned concept`)
  }

  if (
    /\.(?:ts|tsx)$/.test(file) &&
    file.includes('/src/') &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file) &&
    !file.startsWith('apps/web/src/components/ui/')
  ) {
    const lines = lineCount(source)
    const legacyCap = OVERSIZED_PRODUCTION_FILES[file]
    if (legacyCap === undefined && lines > ARCHITECTURE_LINE_CEILING) {
      fail(`${file} is ${lines} lines; the architecture ceiling is ${ARCHITECTURE_LINE_CEILING}`)
    } else if (legacyCap !== undefined && lines > legacyCap) {
      fail(`${file} grew to ${lines} lines above its shrink-only legacy cap of ${legacyCap}`)
    } else if (legacyCap !== undefined && lines <= ARCHITECTURE_LINE_CEILING) {
      fail(`${file} is now ${lines} lines; remove it from OVERSIZED_PRODUCTION_FILES`)
    }
  }
}

if (rawWebServerImportOccurrences > WEB_SERVER_IMPORT_BASELINE.occurrences) {
  fail(
    `Web raw server imports grew from ${WEB_SERVER_IMPORT_BASELINE.occurrences} to ${rawWebServerImportOccurrences} occurrences`,
  )
}
if (rawWebServerImportFiles.size > WEB_SERVER_IMPORT_BASELINE.files) {
  fail(
    `Web files with raw server imports grew from ${WEB_SERVER_IMPORT_BASELINE.files} to ${rawWebServerImportFiles.size}`,
  )
}

for (const [directory, legacyNames] of Object.entries(LEGACY_FEATURE_DIRECTORIES)) {
  const absolute = path.join(root, directory)
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) continue
  const allowed = new Set([...DOMAIN_KEYS, ...legacyNames])
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && !allowed.has(entry.name)) {
      fail(`${directory}/${entry.name} is neither a canonical domain nor recorded legacy`)
    }
  }
}

for (const [file, cap] of Object.entries(OVERSIZED_PRODUCTION_FILES)) {
  const absolute = path.join(root, file)
  try {
    if (!statSync(absolute).isFile())
      fail(`${file} no longer exists; remove its ${cap}-line legacy cap`)
  } catch {
    fail(`${file} no longer exists; remove its ${cap}-line legacy cap`)
  }
}

for (const legacyImport of LEGACY_FOUNDATION_APP_IMPORTS) {
  const separator = legacyImport.indexOf(':')
  const file = legacyImport.slice(0, separator)
  const specifier = legacyImport.slice(separator + 1)
  const source = readFileSync(path.join(root, file), 'utf8')
  if (!importSpecifiers(source).includes(specifier)) {
    fail(`${legacyImport} is gone; remove its foundation-import legacy entry`)
  }
}

if (failures.length > 0) {
  console.error('Architecture boundary drift:\n')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error(
    '\nFix the boundary or shrink the recorded legacy. Never increase a baseline or invent a domain.',
  )
  process.exit(1)
}

console.log(
  `lint-architecture: ok — 10 domains; Web raw server debt ${rawWebServerImportOccurrences}/${WEB_SERVER_IMPORT_BASELINE.occurrences} imports in ${rawWebServerImportFiles.size}/${WEB_SERVER_IMPORT_BASELINE.files} files; ${Object.keys(OVERSIZED_PRODUCTION_FILES).length} oversized files remain`,
)
