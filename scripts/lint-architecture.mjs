#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARCHITECTURE_LINE_CEILING,
  DOMAIN_KEYS,
  DOMAIN_MIGRATIONS,
  LEGACY_FEATURE_DIRECTORIES,
  LEGACY_FOUNDATION_APP_IMPORTS,
  OVERSIZED_PRODUCTION_FILES,
  SUPPORTING_REGIONS,
  TARGET_DOMAIN_ROOTS,
  WEB_SERVER_IMPORT_BASELINE,
} from './architecture/domains.mjs'

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
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, output)
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) output.push(absolute)
  }
  return output
}

function lineCount(source) {
  return source.split('\n').length - (source.endsWith('\n') ? 1 : 0)
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm)].map(
    (match) => match[1],
  )
}

function resolveRelativeSpecifier(fromFileAbsolute, specifier) {
  const base = path.resolve(path.dirname(fromFileAbsolute), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * @param {string} root
 * @param {typeof DOMAIN_MIGRATIONS} migrations
 * @returns {string[]}
 */
export function checkArchitecture(root, migrations = DOMAIN_MIGRATIONS) {
  const failures = []
  const fail = (message) => failures.push(message)
  const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/')

  const migrationKeys = Object.keys(migrations)
  const uniqueDomainKeys = new Set(DOMAIN_KEYS)
  if (
    uniqueDomainKeys.size !== 10 ||
    migrationKeys.length !== 10 ||
    new Set(migrationKeys).size !== 10 ||
    !DOMAIN_KEYS.every((key) => migrationKeys.includes(key))
  ) {
    fail('DOMAIN_MIGRATIONS must define exactly one record for each of the ten canonical domains')
  }
  if (SUPPORTING_REGIONS.some((region) => uniqueDomainKeys.has(region))) {
    fail('a supporting region is also registered as a product domain')
  }

  const registeredPaths = []
  for (const key of migrationKeys) {
    const record = migrations[key]
    const recordKeys = Object.keys(record ?? {})
      .sort()
      .join(',')
    if (recordKeys !== 'legacyPaths,status,targetRoots') {
      fail(`domain ${key} migration record must have exactly status, targetRoots, and legacyPaths`)
      continue
    }
    if (!['legacy', 'migrating', 'complete'].includes(record.status)) {
      fail(`domain ${key} has an unknown migration status: ${record.status}`)
    }
    for (const targetRoot of record.targetRoots) {
      registeredPaths.push(targetRoot)
      const matchesAllowedRoot = TARGET_DOMAIN_ROOTS.some(
        (domainRoot) => targetRoot === `${domainRoot}/${key}`,
      )
      if (!matchesAllowedRoot) {
        fail(
          `${key} target root ${targetRoot} must begin under a registered TARGET_DOMAIN_ROOTS entry and end with its own domain key`,
        )
      }
    }
    for (const legacyPath of record.legacyPaths) registeredPaths.push(legacyPath)

    if (record.status === 'legacy' && record.targetRoots.length > 0) {
      fail(`domain ${key} is legacy but registers a target root`)
    }
    if (
      (record.status === 'migrating' || record.status === 'complete') &&
      record.targetRoots.length === 0
    ) {
      fail(`domain ${key} is ${record.status} but registers no target root`)
    }
    if (record.status === 'complete') {
      for (const legacyPath of record.legacyPaths) {
        if (existsSync(path.join(root, legacyPath))) {
          fail(`domain ${key} is complete but its legacy path still exists: ${legacyPath}`)
        }
      }
    }
  }
  const seenRegisteredPaths = new Set()
  for (const registeredPath of registeredPaths) {
    if (seenRegisteredPaths.has(registeredPath)) {
      fail(`registered path ${registeredPath} is not unique across DOMAIN_MIGRATIONS`)
    }
    seenRegisteredPaths.add(registeredPath)
  }

  const validTargetRoots = new Map()
  for (const domainRoot of TARGET_DOMAIN_ROOTS) {
    for (const key of DOMAIN_KEYS) {
      const candidateRoot = `${domainRoot}/${key}`
      const record = migrations[key]
      const isRegistered = Boolean(record?.targetRoots?.includes(candidateRoot))
      const indexPath = path.join(root, candidateRoot, 'index.ts')
      const hasIndex = existsSync(indexPath) && statSync(indexPath).isFile()
      if (hasIndex && !isRegistered) {
        fail(
          `${candidateRoot}/index.ts exists but is not a registered target root for domain ${key}`,
        )
      } else if (isRegistered && !hasIndex) {
        fail(`${candidateRoot} is a registered target root but has no public index.ts`)
      } else if (isRegistered && hasIndex) {
        validTargetRoots.set(candidateRoot, key)
      }
    }
  }

  const productionRoots = ['apps', 'packages'].map((entry) => path.join(root, entry))
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

    const inTargetDomain = TARGET_DOMAIN_ROOTS.some((domainRoot) =>
      file.startsWith(`${domainRoot}/`),
    )
    if (inTargetDomain && genericFeatureFiles.has(path.basename(file))) {
      fail(`${file} uses a generic feature filename; name the owned concept`)
    }

    const fileRoot = [...validTargetRoots.keys()].find(
      (registeredRoot) =>
        file === `${registeredRoot}/index.ts` || file.startsWith(`${registeredRoot}/`),
    )
    if (fileRoot) {
      for (const specifier of specifiers) {
        if (specifier.startsWith('.')) {
          const resolved = resolveRelativeSpecifier(absolute, specifier)
          if (!resolved) continue
          const resolvedRelative = relative(resolved)
          const foreignRoot = [...validTargetRoots.keys()].find(
            (registeredRoot) =>
              registeredRoot !== fileRoot &&
              (resolvedRelative === `${registeredRoot}/index.ts` ||
                resolvedRelative.startsWith(`${registeredRoot}/`)),
          )
          if (foreignRoot && resolvedRelative !== `${foreignRoot}/index.ts`) {
            fail(
              `${file} deep-imports ${resolvedRelative} across the ${foreignRoot} domain boundary; only its index.ts is public`,
            )
          }
        } else {
          for (const foreignRoot of validTargetRoots.keys()) {
            if (foreignRoot !== fileRoot && specifier.startsWith(foreignRoot)) {
              fail(
                `${file} imports ${specifier} directly into the ${foreignRoot} domain instead of its public entry`,
              )
            }
          }
        }
      }
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
    try {
      const source = readFileSync(path.join(root, file), 'utf8')
      if (!importSpecifiers(source).includes(specifier)) {
        fail(`${legacyImport} is gone; remove its foundation-import legacy entry`)
      }
    } catch {
      fail(`${legacyImport} is gone; remove its foundation-import legacy entry`)
    }
  }

  return failures
}

function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const failures = checkArchitecture(root)

  if (failures.length > 0) {
    console.error('Architecture boundary drift:\n')
    for (const failure of failures) console.error(`  ${failure}`)
    console.error(
      '\nFix the boundary or shrink the recorded legacy. Never increase a baseline or invent a domain.',
    )
    process.exit(1)
  }

  console.log(
    `lint-architecture: ok — 10 domains; ${Object.keys(OVERSIZED_PRODUCTION_FILES).length} oversized files remain`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
