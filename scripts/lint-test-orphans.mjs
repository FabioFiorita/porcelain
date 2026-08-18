#!/usr/bin/env node
/**
 * Test-only orphans: an export whose *only* importers are test files.
 *
 * Knip already reports an export nobody imports. It cannot report this one, because a test
 * file is an importer like any other — so a component that is mounted nowhere, but rendered
 * by its own unit test, reads as used. Coverage agrees with it, `pnpm lint` agrees with it,
 * and CI is green while the code ships to no one.
 *
 * That is not hypothetical. `DevServersSection` sat in this state while `composed-proof.spec.ts`
 * asserted the surface it used to mount, and the e2e failure — not any gate — is what surfaced it.
 *
 * The gate is identity-baselined, not count-baselined. `dead-code.mjs` tracks
 * `{"exports": 198}`, so deleting one dead export and adding another stays green; churn is
 * invisible to it. Here the baseline holds `file::Symbol` rows, so a *different* orphan is a
 * new orphan even when the total does not move.
 *
 * What it deliberately does not flag:
 *
 *   - an export used inside its own file (rendered, therefore alive — an unnecessary `export`
 *     is knip's report to make, not this one)
 *   - an export nobody imports at all (knip's `exports` row already owns it)
 *   - anything under a package's own entry points, or `apps/web/src/components/ui/**`
 *     (vendored shadcn primitives land ahead of their first caller by design)
 *
 * Resolution reads `knip.json`'s `paths` so the two cannot drift.
 *
 *   node scripts/lint-test-orphans.mjs                  # gate
 *   node scripts/lint-test-orphans.mjs --list           # every orphan, including baselined
 *   node scripts/lint-test-orphans.mjs --write-baseline # re-record after mounting or deleting
 *   node scripts/lint-test-orphans.mjs --json
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const BASELINE = path.join(root, 'scripts', 'quality', 'test-orphans-baseline.json')

const SKIP_DIRS = new Set([
  '.expo',
  '.stryker-tmp',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
])

/** Vendored primitives arrive before their first caller; knip ignores them for the same reason. */
const IGNORED_PREFIXES = ['apps/web/src/components/ui/']

/**
 * Modules that exist to serve tests. "Imported only by tests" is their job description, so
 * reporting them would be the report being wrong — the failure mode that got `mock-only`
 * deleted from `test-shape.mjs`.
 */
const TEST_SUPPORT = [/test-support\.tsx?$/, /test-harness\.tsx?$/, /-fixture\.tsx?$/]

const isTestFile = (file) => /\.(test|spec)\.tsx?$/.test(file)
const isTestSupport = (file) => TEST_SUPPORT.some((pattern) => pattern.test(file))

function walk(directory, output = []) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, output)
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      output.push(full)
    }
  }
  return output
}

/**
 * `paths` from knip.json, flattened to absolute prefixes and sorted longest-first so
 * `@porcelain/contracts` wins over a `@porcelain/*` style pattern.
 */
export function readAliases(knipPath) {
  const knip = JSON.parse(readFileSync(knipPath, 'utf8'))
  const knipRoot = path.dirname(knipPath)
  const aliases = []
  for (const [workspace, config] of Object.entries(knip.workspaces ?? {})) {
    for (const [pattern, targets] of Object.entries(config.paths ?? {})) {
      const target = targets[0]
      if (target === undefined) continue
      aliases.push({
        workspace: path.resolve(knipRoot, workspace),
        prefix: pattern.replace(/\*$/, ''),
        wildcard: pattern.endsWith('*'),
        target: path.resolve(knipRoot, workspace, target.replace(/\*$/, '')),
      })
    }
  }
  return aliases.sort((a, b) => b.prefix.length - a.prefix.length)
}

/** A specifier resolves to a file only if that file exists on disk — `.ts`, `.tsx`, or `/index`. */
function resolveToFile(candidate) {
  const attempts = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    path.join(candidate, 'index.ts'),
    path.join(candidate, 'index.tsx'),
  ]
  for (const attempt of attempts) {
    if (existsSync(attempt) && statSync(attempt).isFile()) return attempt
  }
  return null
}

export function resolveSpecifier(specifier, fromFile, aliases) {
  if (specifier.startsWith('.')) {
    return resolveToFile(path.resolve(path.dirname(fromFile), specifier))
  }
  for (const alias of aliases) {
    // A workspace's aliases only apply to files inside that workspace: `@/*` means
    // apps/mobile/src in mobile and nothing at all in apps/web.
    if (!fromFile.startsWith(`${alias.workspace}${path.sep}`)) continue
    if (alias.wildcard && specifier.startsWith(alias.prefix)) {
      return resolveToFile(path.join(alias.target, specifier.slice(alias.prefix.length)))
    }
    if (!alias.wildcard && specifier === alias.prefix) return resolveToFile(alias.target)
  }
  return null
}

/** Every name this file imports, grouped by the specifier it came from. */
function importsOf(source) {
  const found = []
  for (const statement of source.statements) {
    const isImport = ts.isImportDeclaration(statement)
    const isReExport = ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined
    if (!isImport && !isReExport) continue
    const specifierNode = statement.moduleSpecifier
    if (specifierNode === undefined || !ts.isStringLiteral(specifierNode)) continue

    const names = []
    const clause = isImport ? statement.importClause : statement.exportClause
    if (isImport && clause !== undefined) {
      if (clause.name !== undefined) names.push('default')
      const bindings = clause.namedBindings
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          names.push((element.propertyName ?? element.name).text)
        }
      }
      // `import * as x` re-exposes everything; treat it as importing the whole module.
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) names.push('*')
    } else if (clause !== undefined && ts.isNamedExports(clause)) {
      for (const element of clause.elements) names.push((element.propertyName ?? element.name).text)
    } else {
      names.push('*') // `export * from './x'`
    }
    found.push({ specifier: specifierNode.text, names })
  }
  return found
}

/** Exported value names, with the identifier node so self-use can be measured separately. */
function exportsOf(source) {
  const names = []
  const exported = (node) =>
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true

  for (const statement of source.statements) {
    if (!exported(statement)) continue
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name !== undefined) names.push(statement.name.text)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      }
    }
  }
  return names
}

/** How many times a name is referenced in its own file beyond the declaration that names it. */
function selfReferences(source, name) {
  let count = 0
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === name) {
      const parent = node.parent
      const isDeclarationName =
        parent !== undefined &&
        (ts.isFunctionDeclaration(parent) ||
          ts.isClassDeclaration(parent) ||
          ts.isVariableDeclaration(parent)) &&
        parent.name === node
      if (!isDeclarationName) count += 1
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return count
}

export function findTestOnlyOrphans(options = {}) {
  const projectRoot = options.root ?? root
  const aliases = options.aliases ?? readAliases(path.join(projectRoot, 'knip.json'))
  const scanRoots = options.scanRoots ?? [
    'apps/daemon/src',
    'apps/desktop/src',
    'apps/mobile/src',
    'apps/web/src',
    'packages/client-runtime/src',
    'packages/contracts/src',
    'packages/shared/src',
  ]

  const files = scanRoots.flatMap((relative) => walk(path.join(projectRoot, relative)))
  const parsed = new Map()
  for (const file of files) {
    parsed.set(
      file,
      ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true),
    )
  }

  // symbol key -> importing files
  const importers = new Map()
  for (const [file, source] of parsed) {
    for (const entry of importsOf(source)) {
      const target = resolveSpecifier(entry.specifier, file, aliases)
      if (target === null || !parsed.has(target)) continue
      for (const name of entry.names) {
        const key = `${target}::${name}`
        const set = importers.get(key) ?? new Set()
        set.add(file)
        importers.set(key, set)
      }
    }
  }

  const orphans = []
  for (const [file, source] of parsed) {
    if (isTestFile(file) || isTestSupport(file)) continue
    const relative = path.relative(projectRoot, file).split(path.sep).join('/')
    if (IGNORED_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue

    for (const name of exportsOf(source)) {
      // A star import or re-export pulls the whole module in; that is a non-test consumer
      // whenever the file doing it is not itself a test.
      const wildcardUsers = importers.get(`${file}::*`) ?? new Set()
      const named = importers.get(`${file}::${name}`) ?? new Set()
      const all = new Set([...named, ...wildcardUsers])
      if (all.size === 0) continue // knip's `exports` row owns "nobody imports this"
      if ([...all].some((importer) => !isTestFile(importer))) continue
      if (selfReferences(source, name) > 0) continue // rendered in its own file: alive

      orphans.push({
        id: `${relative}::${name}`,
        file: relative,
        symbol: name,
        importers: [...all]
          .map((importer) => path.relative(projectRoot, importer).split(path.sep).join('/'))
          .sort(),
      })
    }
  }
  return orphans.sort((a, b) => a.id.localeCompare(b.id))
}

/** Baseline comparison: new rows fail, disappeared rows only prompt a re-record. */
export function compareToBaseline(orphans, baseline) {
  const known = new Set(baseline)
  const current = new Set(orphans.map((orphan) => orphan.id))
  return {
    added: orphans.filter((orphan) => !known.has(orphan.id)),
    removed: baseline.filter((id) => !current.has(id)),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2))
  const orphans = findTestOnlyOrphans()

  if (args.has('--write-baseline')) {
    writeFileSync(
      BASELINE,
      `${JSON.stringify(
        orphans.map((o) => o.id),
        null,
        2,
      )}\n`,
    )
    process.stdout.write(`test-orphans: baseline written — ${orphans.length} row(s)\n`)
    process.exit(0)
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(orphans, null, 2)}\n`)
    process.exit(0)
  }

  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : []
  const { added, removed } = compareToBaseline(orphans, baseline)

  if (args.has('--list')) {
    for (const orphan of orphans) {
      const mark = baseline.includes(orphan.id) ? ' ' : '+'
      process.stdout.write(
        `${mark} ${orphan.id}\n    imported only by ${orphan.importers.join(', ')}\n`,
      )
    }
  }

  if (added.length > 0) {
    for (const orphan of added) {
      process.stderr.write(
        `${orphan.file}: \`${orphan.symbol}\` is imported only by ${orphan.importers.join(', ')}\n`,
      )
    }
    process.stderr.write(
      `\ntest-orphans: ${added.length} export(s) whose only importer is a test. Mount it, or ` +
        `delete it with its test — a passing test is not a caller, and a baseline row is not a ` +
        `home. If you deliberately retired the surface, delete the code rather than baselining it.\n`,
    )
    process.exit(1)
  }

  if (removed.length > 0) {
    process.stdout.write(
      `test-orphans: ${removed.length} baselined row(s) are gone — re-record with ` +
        `\`pnpm lint:test-orphans:baseline\`\n`,
    )
  }
  process.stdout.write(`test-orphans: ok — ${orphans.length} known orphan(s), none new\n`)
}
