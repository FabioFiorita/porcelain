#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ARCHITECTURE_LINE_CEILING,
  DOMAIN_KEYS,
  DOMAIN_MIGRATIONS,
  LEGACY_FEATURE_DIRECTORIES,
  OVERSIZED_PRODUCTION_FILES,
  SUPPORTING_REGIONS,
  TARGET_DOMAIN_ROOTS,
  TARGET_ROOT_DEEP_IMPORT_BASELINES,
  WEB_SERVER_IMPORT_BASELINE,
} from './architecture/domains.mjs'

const skippedDirectories = new Set([
  '.stryker-tmp',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
  '.expo',
])
const genericFeatureFiles = new Set([
  'common.ts',
  'constants.ts',
  'helpers.ts',
  'manager.ts',
  'service.ts',
  'types.ts',
  'utils.ts',
])

// These mirror the source aliases Porcelain configures for its applications and packages. Keeping
// the mapping here lets the architecture gate resolve a target-domain import to the same file
// whether the importer uses a relative path or the public TypeScript alias.
const NON_RELATIVE_SOURCE_ALIASES = [
  ['@renderer/', 'apps/web/src/'],
  ['@backend/', 'apps/daemon/src/'],
  ['@porcelain/daemon/', 'apps/daemon/src/'],
  ['@/', 'apps/mobile/src/'],
  ['@porcelain/contracts/', 'packages/contracts/src/'],
  ['@porcelain/client-runtime/', 'packages/client-runtime/src/'],
]

const NON_RELATIVE_SOURCE_FILES = [
  ['@porcelain/contracts', 'packages/contracts/src/index.ts'],
  ['@porcelain/client-runtime', 'packages/client-runtime/src/index.ts'],
]

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

function resolveSourceFile(base) {
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

function resolveRelativeSpecifier(fromFileAbsolute, specifier) {
  return resolveSourceFile(path.resolve(path.dirname(fromFileAbsolute), specifier))
}

function resolveNonRelativeSpecifier(root, specifier) {
  const sourceFile = NON_RELATIVE_SOURCE_FILES.find(([alias]) => specifier === alias)
  if (sourceFile) return resolveSourceFile(path.join(root, sourceFile[1]))

  const sourceAlias = NON_RELATIVE_SOURCE_ALIASES.find(([alias]) => specifier.startsWith(alias))
  if (sourceAlias) {
    return resolveSourceFile(
      path.join(root, sourceAlias[1], specifier.slice(sourceAlias[0].length)),
    )
  }

  if (specifier.startsWith('apps/') || specifier.startsWith('packages/')) {
    return resolveSourceFile(path.join(root, specifier))
  }

  return null
}

function isRepositoryRelativePosixPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) return false
  if (value === '.' || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false
  if (path.posix.normalize(value) !== value) return false
  return !value.split('/').some((segment) => segment === '.' || segment === '..')
}

function describeMalformedValue(value) {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

function validatePathList(key, field, value, fail) {
  if (!Array.isArray(value)) {
    fail(
      `domain ${key} ${field} must be an array of unique normalized repository-relative POSIX paths`,
    )
    return []
  }

  const paths = []
  const seen = new Set()
  for (const entry of value) {
    if (!isRepositoryRelativePosixPath(entry)) {
      fail(
        `domain ${key} ${field} contains an invalid repository-relative POSIX path: ${describeMalformedValue(entry)}`,
      )
      continue
    }
    if (seen.has(entry)) {
      fail(`domain ${key} ${field} contains a duplicate path: ${entry}`)
      continue
    }
    seen.add(entry)
    paths.push(entry)
  }
  return paths
}

/**
 * @param {string} root
 * @param {typeof DOMAIN_MIGRATIONS} migrations
 * @param {typeof TARGET_ROOT_DEEP_IMPORT_BASELINES} [deepImportBaselines]
 * @param {{ rejectUnregisteredBaselineRoots?: boolean }} [options]
 *   `rejectUnregisteredBaselineRoots` defaults to true when `migrations` is the live
 *   `DOMAIN_MIGRATIONS` catalog (repository / production check). Fixture checks that pass a
 *   custom migration catalog default to false so they can omit unrelated default roots without
 *   noise. Pass the flag explicitly to assert production-mode stale-root behavior in fixtures.
 * @returns {string[]}
 */
export function checkArchitecture(
  root,
  migrations = DOMAIN_MIGRATIONS,
  deepImportBaselines = TARGET_ROOT_DEEP_IMPORT_BASELINES,
  options = {},
) {
  const failures = []
  const fail = (message) => failures.push(message)
  const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/')
  const rejectUnregisteredBaselineRoots =
    options.rejectUnregisteredBaselineRoots ?? migrations === DOMAIN_MIGRATIONS

  const migrationsAreRecords =
    migrations !== null && typeof migrations === 'object' && !Array.isArray(migrations)
  const migrationKeys = migrationsAreRecords ? Object.keys(migrations) : []
  const uniqueDomainKeys = new Set(DOMAIN_KEYS)
  if (
    uniqueDomainKeys.size !== 11 ||
    migrationKeys.length !== 11 ||
    new Set(migrationKeys).size !== 11 ||
    !DOMAIN_KEYS.every((key) => migrationKeys.includes(key))
  ) {
    fail(
      'DOMAIN_MIGRATIONS must define exactly one record for each of the eleven canonical domains',
    )
  }
  if (SUPPORTING_REGIONS.some((region) => uniqueDomainKeys.has(region))) {
    fail('a supporting region is also registered as a product domain')
  }

  // Normalize early so source scanning never indexes a non-object catalog (null throws).
  // Malformed catalogs still fail below; scanning treats them as empty.
  const baselinesAreRecords =
    deepImportBaselines !== null &&
    typeof deepImportBaselines === 'object' &&
    !Array.isArray(deepImportBaselines)
  if (!baselinesAreRecords) {
    fail('TARGET_ROOT_DEEP_IMPORT_BASELINES must be an object of root → { occurrences, files }')
  }
  /** @type {Record<string, unknown>} */
  const baselineCatalog = baselinesAreRecords ? deepImportBaselines : {}

  const registeredPaths = []
  const validatedMigrations = new Map()
  for (const key of migrationKeys) {
    const record = migrations[key]
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      fail(`domain ${key} migration record must be an object`)
      continue
    }
    const recordKeys = Object.keys(record ?? {})
      .sort()
      .join(',')
    if (recordKeys !== 'legacyPaths,status,targetRoots') {
      fail(`domain ${key} migration record must have exactly status, targetRoots, and legacyPaths`)
      continue
    }
    if (!['legacy', 'migrating', 'complete'].includes(record.status)) {
      fail(
        `domain ${key} has an unknown migration status: ${describeMalformedValue(record.status)}`,
      )
    }
    const targetRoots = validatePathList(key, 'targetRoots', record.targetRoots, fail)
    const legacyPaths = validatePathList(key, 'legacyPaths', record.legacyPaths, fail)
    validatedMigrations.set(key, { status: record.status, targetRoots, legacyPaths })

    for (const targetRoot of targetRoots) {
      registeredPaths.push(targetRoot)
      const matchesAllowedRoot = TARGET_DOMAIN_ROOTS.some(
        (domainRoot) => path.posix.dirname(targetRoot) === domainRoot,
      )
      if (!matchesAllowedRoot) {
        fail(
          `${key} target root ${targetRoot} must be a direct child of a registered TARGET_DOMAIN_ROOTS entry`,
        )
      }
      const targetName = path.posix.basename(targetRoot)
      if (DOMAIN_KEYS.includes(targetName) && targetName !== key) {
        fail(`${key} target root ${targetRoot} claims the canonical ${targetName} domain name`)
      }
    }
    for (const legacyPath of legacyPaths) registeredPaths.push(legacyPath)

    if (record.status === 'legacy' && targetRoots.length > 0) {
      fail(`domain ${key} is legacy but registers a target root`)
    }
    if (
      (record.status === 'migrating' || record.status === 'complete') &&
      targetRoots.length === 0
    ) {
      fail(`domain ${key} is ${record.status} but registers no target root`)
    }
    if (record.status === 'complete') {
      for (const legacyPath of legacyPaths) {
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
      const record = validatedMigrations.get(key)
      const isRegistered = Boolean(record?.targetRoots.includes(candidateRoot))
      const indexPath = path.join(root, candidateRoot, 'index.ts')
      const hasIndex = existsSync(indexPath) && statSync(indexPath).isFile()
      if (hasIndex && !isRegistered) {
        fail(
          `${candidateRoot}/index.ts exists but is not a registered target root for domain ${key}`,
        )
      }
    }
  }
  for (const [key, record] of validatedMigrations) {
    for (const targetRoot of record.targetRoots) {
      const indexPath = path.join(root, targetRoot, 'index.ts')
      const hasIndex = existsSync(indexPath) && statSync(indexPath).isFile()
      if (!hasIndex) {
        fail(`${targetRoot} is a registered target root but has no public index.ts`)
      } else {
        validTargetRoots.set(targetRoot, key)
      }
    }
  }

  const productionRoots = ['apps', 'packages'].map((entry) => path.join(root, entry))
  const sourceFiles = productionRoots.flatMap((directory) => walk(directory))
  let rawWebServerImportOccurrences = 0
  const rawWebServerImportFiles = new Set()
  /** @type {Map<string, { occurrences: number, files: Set<string> }>} */
  const externalDeepImportsByRoot = new Map()
  for (const targetRoot of validTargetRoots.keys()) {
    externalDeepImportsByRoot.set(targetRoot, { occurrences: 0, files: new Set() })
  }

  for (const absolute of sourceFiles) {
    const file = relative(absolute)
    const source = readFileSync(absolute, 'utf8')
    const specifiers = importSpecifiers(source)
    const isProductionSource =
      /\.(?:ts|tsx)$/.test(file) &&
      file.includes('/src/') &&
      !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file)

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
          fail(`${file} crosses from a foundation package into an application: ${specifier}`)
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
    for (const specifier of specifiers) {
      const resolved = specifier.startsWith('.')
        ? resolveRelativeSpecifier(absolute, specifier)
        : resolveNonRelativeSpecifier(root, specifier)
      if (!resolved) continue

      const resolvedRelative = relative(resolved)
      const targetRoot = [...validTargetRoots.keys()].find(
        (registeredRoot) =>
          resolvedRelative === `${registeredRoot}/index.ts` ||
          resolvedRelative.startsWith(`${registeredRoot}/`),
      )
      if (!targetRoot) continue
      // Public index is always allowed.
      if (resolvedRelative === `${targetRoot}/index.ts`) continue
      // Internal imports within the same registered root are allowed.
      if (fileRoot === targetRoot) continue

      if (fileRoot && fileRoot !== targetRoot) {
        // Stricter path: registered root → foreign registered root internals fail immediately.
        // These never count against a shrink-only external baseline.
        fail(
          `${file} deep-imports ${resolvedRelative} across the ${targetRoot} domain boundary; only its index.ts is public`,
        )
        continue
      }

      // Importer is outside any registered root (or outside this target): external deep import.
      if (!isProductionSource) continue
      const baseline = baselineCatalog[targetRoot]
      if (baseline === undefined) {
        fail(
          `${file} deep-imports ${resolvedRelative} into registered target root ${targetRoot}; only its index.ts is public (record a shrink-only TARGET_ROOT_DEEP_IMPORT_BASELINES entry only for inventoried migration debt)`,
        )
        continue
      }
      const bucket = externalDeepImportsByRoot.get(targetRoot)
      if (bucket) {
        bucket.occurrences += 1
        bucket.files.add(file)
      }
    }

    if (isProductionSource && !file.startsWith('apps/web/src/components/ui/')) {
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

  for (const [targetRoot, baseline] of Object.entries(baselineCatalog)) {
    if (!validTargetRoots.has(targetRoot)) {
      // Production/default-catalog mode: a baseline for an unregistered root is stale debt ledger.
      // Fixture checks with custom migrations default rejectUnregisteredBaselineRoots=false so
      // they can pass a partial baseline map (or inherit default baselines) without noise.
      if (rejectUnregisteredBaselineRoots) {
        fail(
          `TARGET_ROOT_DEEP_IMPORT_BASELINES names ${targetRoot} which is not a registered target root; remove the stale baseline entry`,
        )
      }
      continue
    }
    if (baseline === null || typeof baseline !== 'object' || Array.isArray(baseline)) {
      fail(
        `TARGET_ROOT_DEEP_IMPORT_BASELINES[${targetRoot}] must be { occurrences: number, files: number }`,
      )
      continue
    }
    const recordKeys = Object.keys(baseline).sort().join(',')
    if (recordKeys !== 'files,occurrences') {
      fail(
        `TARGET_ROOT_DEEP_IMPORT_BASELINES[${targetRoot}] must have exactly occurrences and files`,
      )
      continue
    }
    const { occurrences, files } = /** @type {{ occurrences: unknown, files: unknown }} */ (
      baseline
    )
    if (
      !Number.isInteger(occurrences) ||
      !Number.isInteger(files) ||
      /** @type {number} */ (occurrences) < 0 ||
      /** @type {number} */ (files) < 0
    ) {
      fail(
        `TARGET_ROOT_DEEP_IMPORT_BASELINES[${targetRoot}] occurrences and files must be finite non-negative integers`,
      )
      continue
    }
    const actual = externalDeepImportsByRoot.get(targetRoot) ?? {
      occurrences: 0,
      files: new Set(),
    }
    if (actual.occurrences > occurrences) {
      fail(
        `External deep imports into ${targetRoot} grew from ${occurrences} to ${actual.occurrences} occurrences`,
      )
    }
    if (actual.files.size > files) {
      fail(
        `Files with external deep imports into ${targetRoot} grew from ${files} to ${actual.files.size}`,
      )
    }
    if (actual.occurrences === 0 && actual.files.size === 0) {
      fail(
        `External deep imports into ${targetRoot} reached zero; remove its TARGET_ROOT_DEEP_IMPORT_BASELINES entry`,
      )
    }
  }

  for (const [directory, legacyNames] of Object.entries(LEGACY_FEATURE_DIRECTORIES)) {
    const absolute = path.join(root, directory)
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) continue
    const registeredNames = [...validTargetRoots.keys()]
      .filter((targetRoot) => path.posix.dirname(targetRoot) === directory)
      .map((targetRoot) => path.posix.basename(targetRoot))
    const allowed = new Set([...DOMAIN_KEYS, ...legacyNames, ...registeredNames])
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
    `lint-architecture: ok — ${DOMAIN_KEYS.length} domains; ${Object.keys(OVERSIZED_PRODUCTION_FILES).length} oversized files remain`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
