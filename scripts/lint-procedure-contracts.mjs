#!/usr/bin/env node
/**
 * Permanent wire-truth gate. The ten canonical domain procedure records are the only source of
 * procedure names, kinds, and schemas; `procedureCatalog` composes them into exactly 113 unique
 * entries. Every production daemon router procedure must bind its own catalog entry's input and
 * output exactly once, and the router and catalog name sets must be identical.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DOMAIN_KEYS = [
  'remote',
  'projects',
  'files',
  'search',
  'git',
  'review',
  'board',
  'actions',
  'terminal',
  'project-data',
]

/**
 * Production router sources relative to `apps/daemon/src`. Horizontal routers stay under
 * `router/`; migrated domains (Board first) live under `features/<domain>/`.
 */
export const PRODUCTION_ROUTER_FILES = [
  'features/actions/actions-router.ts',
  'features/board/board-router.ts',
  'features/files/files-router.ts',
  'features/git/git-router.ts',
  'features/project-data/project-data-router.ts',
  'features/projects/projects-router.ts',
  'features/remote/remote-network-router.ts',
  'features/remote/remote-router.ts',
  'features/review/comment-router.ts',
  'features/review/review-evidence-router.ts',
  'features/review/review-lifecycle-router.ts',
  'features/review/review-reading-router.ts',
  'features/search/search-router.ts',
  'features/terminal/terminal-router.ts',
  'router/git.ts',
  'router/repos.ts',
  'router/review.ts',
  'router/settings.ts',
]

export const PROCEDURE_COUNT = 113

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function extractRouterProcedures(source, filename) {
  // Two spaces for a top-level router object; four for a create*Router factory body.
  const starts = [...source.matchAll(/^ {2,4}(\w+):\s*(?:public|admin)Procedure/gm)]
  return starts.map((match, index) => {
    const end = starts[index + 1]?.index ?? source.length
    const block = source.slice(match.index, end)
    const kind = /\.(query|mutation)\s*\(/.exec(block)?.[1]
    return { filename, name: match[1], kind, block }
  })
}

function readRouterProcedures(repositoryRoot) {
  const daemonSrc = join(repositoryRoot, 'apps', 'daemon', 'src')
  const procedures = []
  const sources = {}
  const files = []
  for (const relativePath of PRODUCTION_ROUTER_FILES) {
    const absolute = join(daemonSrc, relativePath)
    if (!existsSync(absolute)) continue
    files.push(relativePath)
    const source = readFileSync(absolute, 'utf8')
    sources[relativePath] = source
    for (const procedure of extractRouterProcedures(source, relativePath)) {
      procedures.push({ ...procedure, source: `apps/daemon/src/${relativePath}` })
    }
  }
  // Discover unexpected router/*.ts files that are not on the production list.
  const routerDir = join(daemonSrc, 'router')
  for (const name of readdirSync(routerDir)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    .sort()) {
    const relativePath = `router/${name}`
    if (!files.includes(relativePath)) files.push(relativePath)
  }
  return { files, procedures, sources }
}

/** Names, domains, and kinds come only from the ten domain procedure records. */
export function readDomainRecords(repositoryRoot) {
  const records = []
  const missingDomains = []
  for (const domain of DOMAIN_KEYS) {
    const file = join(
      repositoryRoot,
      'packages',
      'contracts',
      'src',
      domain,
      `${domain}.procedures.ts`,
    )
    if (!existsSync(file)) {
      missingDomains.push(domain)
      continue
    }
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/^\s{2,}(\w+):\s*\{\s*kind:\s*'(query|mutation)'/gm)) {
      records.push({ domain, name: match[1], kind: match[2], source: `${domain}.procedures.ts` })
    }
  }
  return { records, missingDomains }
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

function procedureLabel({ filename, name }) {
  return `apps/daemon/src/${filename}:${name}`
}

function directlyImportsProcedureCatalog(source) {
  for (const match of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g,
  )) {
    if (match[2] !== '@porcelain/contracts') continue
    const names = match[1].split(',').map((specifier) => specifier.trim())
    if (names.includes('procedureCatalog')) return true
  }
  return false
}

/**
 * The domain records compose exactly the 113-name catalog: canonical domains only, unique names,
 * and one `query`/`mutation` kind per procedure.
 */
export function checkDomainCatalog({ domainRecords, missingDomains = [] }) {
  const failures = []

  for (const domain of missingDomains) {
    failures.push(`domain procedure record is missing: ${domain}.procedures.ts`)
  }
  for (const duplicate of duplicateValues(domainRecords.map(({ name }) => name))) {
    failures.push(`procedure is defined by more than one domain record: ${duplicate}`)
  }
  for (const record of domainRecords) {
    if (!DOMAIN_KEYS.includes(record.domain)) {
      failures.push(`procedure has a non-canonical domain: ${record.name} (${record.domain})`)
    }
    if (record.kind !== 'query' && record.kind !== 'mutation') {
      failures.push(`procedure has an invalid kind: ${record.name}`)
    }
  }
  if (domainRecords.length !== PROCEDURE_COUNT) {
    failures.push(
      `domain records must define exactly ${PROCEDURE_COUNT} procedures: found ${domainRecords.length}`,
    )
  }

  return failures
}

/**
 * Every production router file is known, present, and contract-validated; every router procedure
 * binds its own catalog input and output exactly once; router and catalog names match exactly.
 */
export function checkRouterCatalogBinding({
  routerFiles,
  routerProcedures,
  routerSources = {},
  domainRecords,
}) {
  const failures = []
  const productionFiles = new Set(PRODUCTION_ROUTER_FILES)
  const routerFileSet = new Set(routerFiles)
  const recordByName = new Map(domainRecords.map((record) => [record.name, record]))

  for (const duplicate of duplicateValues(routerFiles)) {
    failures.push(`production router filename appears more than once: ${duplicate}`)
  }
  for (const filename of routerFiles) {
    if (!filename.endsWith('.ts') || filename.endsWith('.test.ts')) {
      failures.push(`router filename is not a production router file: ${filename}`)
    } else if (!productionFiles.has(filename)) {
      failures.push(`unknown production router filename: ${filename}`)
    }
  }
  for (const filename of PRODUCTION_ROUTER_FILES) {
    if (!routerFileSet.has(filename)) {
      failures.push(`production router file is missing: ${filename}`)
      continue
    }
    if (!directlyImportsProcedureCatalog(routerSources[filename] ?? '')) {
      failures.push(
        `router must import procedureCatalog directly from @porcelain/contracts: ${filename}`,
      )
    }
  }

  for (const duplicate of duplicateValues(routerProcedures.map(({ name }) => name))) {
    failures.push(`daemon procedure appears more than once: ${duplicate}`)
  }

  for (const procedure of routerProcedures) {
    if (!productionFiles.has(procedure.filename)) continue
    const label = procedureLabel(procedure)
    const record = recordByName.get(procedure.name)

    if (!record) {
      failures.push(`router procedure has no domain contract record: ${procedure.name}`)
    } else if (record.kind !== procedure.kind) {
      failures.push(
        `procedure kind drift for ${procedure.name}: router=${procedure.kind ?? 'unknown'} record=${record.kind}`,
      )
    }

    const inputCount = countMatches(procedure.block, /\.input\s*\(/g)
    const canonicalInputCount = countMatches(
      procedure.block,
      new RegExp(`\\.input\\s*\\(\\s*procedureCatalog\\.${procedure.name}\\.input\\s*\\)`, 'g'),
    )
    if (inputCount === 0) {
      failures.push(`router procedure input is missing: ${label}`)
    } else if (inputCount > 1) {
      failures.push(`router procedure input is duplicated: ${label}`)
    } else if (canonicalInputCount !== 1) {
      failures.push(
        `router procedure input is wrong: ${label} (expected .input(procedureCatalog.${procedure.name}.input))`,
      )
    }

    const outputCount = countMatches(procedure.block, /\.output\s*\(/g)
    const canonicalOutputCount = countMatches(
      procedure.block,
      new RegExp(`\\.output\\s*\\(\\s*procedureCatalog\\.${procedure.name}\\.output\\s*\\)`, 'g'),
    )
    if (outputCount === 0) {
      failures.push(`router procedure output is missing: ${label}`)
    } else if (outputCount > 1) {
      failures.push(`router procedure output is duplicated: ${label}`)
    } else if (canonicalOutputCount !== 1) {
      failures.push(
        `router procedure output is wrong: ${label} (expected .output(procedureCatalog.${procedure.name}.output))`,
      )
    }
  }

  const routerNames = new Set(routerProcedures.map(({ name }) => name))
  for (const record of domainRecords) {
    if (!routerNames.has(record.name)) {
      failures.push(`contract procedure is absent from routers: ${record.name}`)
    }
  }

  return failures
}

export function checkProcedureContracts(repositoryRoot = root) {
  const routers = readRouterProcedures(repositoryRoot)
  const { records, missingDomains } = readDomainRecords(repositoryRoot)

  return [
    ...checkDomainCatalog({ domainRecords: records, missingDomains }),
    ...checkRouterCatalogBinding({
      routerFiles: routers.files,
      routerProcedures: routers.procedures,
      routerSources: routers.sources,
      domainRecords: records,
    }),
  ]
}

function main() {
  const failures = checkProcedureContracts()
  if (failures.length > 0) {
    console.error('Procedure contract drift:\n')
    for (const failure of failures) console.error(`  ${failure}`)
    console.error('\nRepair the domain record or router; do not weaken the executor contract.')
    process.exit(1)
  }

  const { records } = readDomainRecords(root)
  const routers = readRouterProcedures(root)
  console.log(
    `lint-procedure-contracts: ok — ${records.length} contract procedures across ${DOMAIN_KEYS.length} domains, ${routers.procedures.length} router procedures validated`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
