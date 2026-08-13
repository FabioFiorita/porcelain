#!/usr/bin/env node
/**
 * SUP-003 — lock Desktop main/preload to integration plus the client address book.
 *
 * Desktop may import three blessed @backend infrastructure specifiers. It must not
 * import Web/mobile/domain features or fork a second daemon via child_process.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skippedDirectories = new Set(['node_modules', 'out', 'dist', 'build', 'coverage'])

const DESKTOP_ROOTS = ['apps/desktop/src/main', 'apps/desktop/src/preload']

const FEATURE_PREFIXES = ['@renderer/', '@/features/', '@backend/features/']

const BLESSED_BACKEND = new Set([
  '@backend/net/admin-token',
  '@backend/cli-install',
  '@backend/fs/external-url',
])

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

function isBlessedBackend(specifier) {
  return BLESSED_BACKEND.has(specifier) || BLESSED_BACKEND.has(specifier.replace(/\/index$/, ''))
}

function isForbiddenFeature(specifier) {
  return FEATURE_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(prefix))
}

function isForbiddenBackend(specifier) {
  if (specifier !== '@backend/' && !specifier.startsWith('@backend/')) return false
  return !isBlessedBackend(specifier)
}

function isForbiddenChildProcess(specifier) {
  return (
    specifier === 'node:child_process' ||
    specifier.startsWith('node:child_process/') ||
    specifier === 'child_process' ||
    specifier.startsWith('child_process/')
  )
}

function collectProductionFiles(root) {
  const files = []
  for (const relativeRoot of DESKTOP_ROOTS) {
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
export function checkDesktopBoundary(root) {
  const failures = []
  const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/')

  for (const absolute of collectProductionFiles(root)) {
    const file = relative(absolute)
    const source = readFileSync(absolute, 'utf8')

    for (const specifier of importSpecifiers(source)) {
      if (isForbiddenFeature(specifier)) {
        failures.push(`${file} imports forbidden Web/mobile/feature specifier: ${specifier}`)
        continue
      }
      if (isForbiddenBackend(specifier)) {
        failures.push(`${file} imports forbidden @backend specifier: ${specifier}`)
        continue
      }
      if (isForbiddenChildProcess(specifier)) {
        failures.push(`${file} imports forbidden child_process specifier: ${specifier}`)
      }
    }
  }

  return failures
}

function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const failures = checkDesktopBoundary(root)

  if (failures.length > 0) {
    console.error('Desktop boundary drift:\n')
    for (const failure of failures) console.error(`  ${failure}`)
    console.error(
      '\nDesktop main/preload stay integration plus the client address book: no Web/mobile/feature imports, no child_process forks.',
    )
    process.exit(1)
  }

  console.log(
    'lint-desktop-boundary: ok — Desktop main/preload stay integration plus the client address book',
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
