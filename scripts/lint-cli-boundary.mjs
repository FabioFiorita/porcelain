#!/usr/bin/env node
/**
 * CLI-001 — lock the agent CLI to a built-in-plus-shared direct filesystem channel.
 *
 * The porcelain CLI is a synchronous companion-file writer, not a daemon RPC client.
 * This gate freezes that shape before any noun/verb ownership cutover:
 *   - production imports: relative inside apps/cli/src, node: builtins, shared only
 *   - no network modules or listener/connection construction
 *   - exactly one runtime dependency: @porcelain/shared workspace:*
 *   - project-io JSON writes stay same-directory tmp + renameSync
 *   - CLI esbuild entry/output/bundle/packages stay single-file; no external option
 *   - command registry never gains a `run` verb
 *
 * Modeled on scripts/lint-architecture.mjs conventions (walk, importSpecifiers,
 * collect-all-then-return, fixture-tested). The PRO-004 buildProtocol target in
 * build-node.mjs is intentionally out of scope — only the CLI build is locked.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skippedDirectories = new Set(['node_modules', 'out', 'dist', 'build', 'coverage'])

/** Network modules the agent CLI must never import (node: prefix or package name). */
const FORBIDDEN_NETWORK_MODULES = new Set([
  'node:http',
  'node:https',
  'node:net',
  'node:dgram',
  'ws',
  '@trpc/client',
])

/**
 * Listener / connection construction the CLI must never open. Existing
 * `execFileSync('git', ...)` is not in this list and remains permitted.
 */
const FORBIDDEN_CALL_PATTERNS = [
  { re: /\.listen\s*\(/, label: '.listen(' },
  { re: /\bcreateServer\s*\(/, label: 'createServer(' },
  { re: /\bcreateConnection\s*\(/, label: 'createConnection(' },
  { re: /\bWebSocket\s*\(/, label: 'WebSocket(' },
]

/** Specifiers that are always the shared workspace package (package name or monorepo alias). */
function isSharedWorkspaceSpecifier(specifier) {
  return (
    specifier === '@porcelain/shared' ||
    specifier.startsWith('@porcelain/shared/') ||
    specifier === '@shared' ||
    specifier.startsWith('@shared/')
  )
}

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

/** Deterministic textual import/export specifier extraction (same approach as lint-architecture). */
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

function isInsideDirectory(absoluteFile, directory) {
  const relative = path.relative(directory, absoluteFile)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Extract a top-level `async function name` / `function name` body for scoped
 * inspection so daemon/protocol targets in the same file are not constrained.
 */
function extractFunctionSource(source, functionName) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`, 'm')
  const match = pattern.exec(source)
  if (!match) return null
  const openBrace = match.index + match[0].length - 1
  let depth = 0
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(match.index, index + 1)
    }
  }
  return source.slice(match.index)
}

/**
 * @param {string} root repository root
 * @returns {string[]} violation messages (empty when clean)
 */
export function checkCliBoundary(root) {
  const failures = []
  const fail = (message) => failures.push(message)
  const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/')

  const cliSrcRoot = path.join(root, 'apps', 'cli', 'src')
  const packageJsonPath = path.join(root, 'apps', 'cli', 'package.json')
  const projectIoPath = path.join(cliSrcRoot, 'project-io.ts')
  const buildNodePath = path.join(root, 'scripts', 'build-node.mjs')

  // --- package.json: exactly one runtime dependency ---
  if (!existsSync(packageJsonPath)) {
    fail('apps/cli/package.json is missing')
  } else {
    let packageJson
    try {
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    } catch {
      fail('apps/cli/package.json is not valid JSON')
      packageJson = null
    }
    if (packageJson !== null) {
      const dependencies =
        packageJson.dependencies !== null &&
        typeof packageJson.dependencies === 'object' &&
        !Array.isArray(packageJson.dependencies)
          ? packageJson.dependencies
          : null
      if (dependencies === null) {
        fail(
          'apps/cli/package.json must declare exactly one runtime dependency: @porcelain/shared workspace:*',
        )
      } else {
        const keys = Object.keys(dependencies)
        if (
          keys.length !== 1 ||
          keys[0] !== '@porcelain/shared' ||
          dependencies['@porcelain/shared'] !== 'workspace:*'
        ) {
          fail(
            `apps/cli/package.json must have exactly one runtime dependency @porcelain/shared: workspace:* (found: ${JSON.stringify(dependencies)})`,
          )
        }
      }
    }
  }

  // --- project-io atomic JSON replacement ---
  if (!existsSync(projectIoPath)) {
    fail('apps/cli/src/project-io.ts is missing')
  } else {
    const projectIo = readFileSync(projectIoPath, 'utf8')
    const hasTmp =
      /(?:const|let)\s+tmp\s*=\s*`\$\{path\}\.tmp`/.test(projectIo) ||
      /(?:const|let)\s+tmp\s*=\s*.*\.tmp/.test(projectIo)
    const hasWriteTmp = /writeFileSync\s*\(\s*tmp\s*,/.test(projectIo)
    const hasRename = /renameSync\s*\(\s*tmp\s*,\s*path\s*\)/.test(projectIo)
    const hasDirectFinalWrite = /writeFileSync\s*\(\s*path\s*,/.test(projectIo)

    if (!hasTmp || !hasWriteTmp || !hasRename) {
      fail(
        'apps/cli/src/project-io.ts must write JSON via a same-directory temporary path then renameSync(tmp, path)',
      )
    }
    if (hasDirectFinalWrite) {
      fail(
        'apps/cli/src/project-io.ts must not writeFileSync(path, ...) directly to the final JSON path',
      )
    }
  }

  // --- CLI build configuration (buildCli only; buildProtocol/daemon may use external) ---
  if (!existsSync(buildNodePath)) {
    fail('scripts/build-node.mjs is missing')
  } else {
    const buildSource = readFileSync(buildNodePath, 'utf8')
    const buildCliSource = extractFunctionSource(buildSource, 'buildCli')
    if (buildCliSource === null) {
      fail('scripts/build-node.mjs must define buildCli()')
    } else {
      const hasEntry =
        /apps['"]\s*,\s*['"]cli['"]\s*,\s*['"]src['"]\s*,\s*['"]porcelain\.ts['"]/.test(
          buildCliSource,
        ) ||
        /apps\/cli\/src\/porcelain\.ts/.test(buildCliSource) ||
        /['"]cli['"]\s*,\s*['"]src['"]\s*,\s*['"]porcelain\.ts['"]/.test(buildCliSource)
      const hasOutfile =
        /cli['"]\s*,\s*['"]porcelain\.js['"]/.test(buildCliSource) ||
        /cli\/porcelain\.js/.test(buildCliSource)
      const hasPackagesBundle = /packages\s*:\s*['"]bundle['"]/.test(buildCliSource)
      // bundle: true may live on the shared `common` object spread into buildCli
      const hasBundleTrue =
        /bundle\s*:\s*true/.test(buildCliSource) ||
        (/\.\.\.\s*common\b/.test(buildCliSource) && /bundle\s*:\s*true/.test(buildSource))
      const hasExternal = /\bexternal\s*:/.test(buildCliSource)

      if (!hasEntry) {
        fail('scripts/build-node.mjs buildCli must keep entryPoints at apps/cli/src/porcelain.ts')
      }
      if (!hasOutfile) {
        fail(
          'scripts/build-node.mjs buildCli must keep outfile at apps/desktop/out/main/cli/porcelain.js',
        )
      }
      if (!hasBundleTrue) {
        fail('scripts/build-node.mjs buildCli must keep bundle: true')
      }
      if (!hasPackagesBundle) {
        fail("scripts/build-node.mjs buildCli must keep packages: 'bundle'")
      }
      if (hasExternal) {
        fail(
          'scripts/build-node.mjs buildCli must not declare an external option (CLI stays a single fully-bundled file)',
        )
      }
    }
  }

  // --- production source under apps/cli/src ---
  if (!existsSync(cliSrcRoot)) {
    fail('apps/cli/src is missing')
    return failures
  }

  const productionFiles = walk(cliSrcRoot).filter((absolute) => !isTestFile(absolute))

  for (const absolute of productionFiles) {
    const file = relative(absolute)
    const source = readFileSync(absolute, 'utf8')
    const specifiers = importSpecifiers(source)

    for (const specifier of specifiers) {
      if (FORBIDDEN_NETWORK_MODULES.has(specifier)) {
        fail(`${file} imports forbidden network module: ${specifier}`)
        continue
      }

      if (specifier.startsWith('node:')) {
        // Other node: builtins (fs, path, child_process, …) are permitted.
        continue
      }

      if (isSharedWorkspaceSpecifier(specifier)) {
        continue
      }

      if (specifier.startsWith('.')) {
        const resolvedBase = path.resolve(path.dirname(absolute), specifier)
        const resolved = resolveSourceFile(resolvedBase)
        const target = resolved ?? resolvedBase
        if (!isInsideDirectory(target, cliSrcRoot) && target !== cliSrcRoot) {
          fail(`${file} imports outside apps/cli/src: ${specifier} → ${relative(target) || target}`)
        }
        continue
      }

      // Bare specifier that is not shared and not node:
      fail(
        `${file} imports disallowed bare specifier: ${specifier} (only relative apps/cli/src, node: builtins, and @porcelain/shared / @shared are allowed)`,
      )
    }

    for (const { re, label } of FORBIDDEN_CALL_PATTERNS) {
      if (re.test(source)) {
        fail(`${file} constructs a network listener/connection via ${label}`)
      }
    }

    if (/\bverb\s*:\s*['"]run['"]/.test(source)) {
      fail(`${file} registers a forbidden 'run' command verb`)
    }
  }

  return failures
}

function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const failures = checkCliBoundary(root)

  if (failures.length > 0) {
    console.error('CLI boundary drift:\n')
    for (const failure of failures) console.error(`  ${failure}`)
    console.error(
      '\nThe agent CLI stays a direct filesystem channel: no daemon client, no listener, no run verb, shared-only deps, atomic JSON writes, single-file bundle.',
    )
    process.exit(1)
  }

  console.log(
    'lint-cli-boundary: ok — CLI locked to node:+shared filesystem channel (no network, no run, atomic writes, bundled)',
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
