#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkDomainCatalog,
  checkProcedureContracts,
  checkRouterCatalogBinding,
  DOMAIN_KEYS,
  extractRouterProcedures,
  PROCEDURE_COUNT,
  PRODUCTION_ROUTER_FILES,
} from './lint-procedure-contracts.mjs'

/** A synthetic full-size domain record set: exactly PROCEDURE_COUNT unique canonical procedures. */
function domainRecords(overrides = []) {
  const records = []
  for (let index = 0; index < PROCEDURE_COUNT; index += 1) {
    records.push({
      domain: DOMAIN_KEYS[index % DOMAIN_KEYS.length],
      name: `procedure${index}`,
      kind: index % 2 === 0 ? 'query' : 'mutation',
      source: 'synthetic.procedures.ts',
    })
  }
  return [...records, ...overrides]
}

test('accepts exactly the ten-domain catalog at its required size', () => {
  assert.deepEqual(checkDomainCatalog({ domainRecords: domainRecords() }), [])
})

test('rejects a duplicate catalog name across domain records', () => {
  const records = domainRecords()
  records[1] = { ...records[1], name: records[0].name }
  assert.ok(
    checkDomainCatalog({ domainRecords: records }).some((failure) =>
      failure.includes(`procedure is defined by more than one domain record: ${records[0].name}`),
    ),
  )
})

test('rejects a missing catalog entry', () => {
  const records = domainRecords().slice(0, PROCEDURE_COUNT - 1)
  assert.ok(
    checkDomainCatalog({ domainRecords: records }).some((failure) =>
      failure.includes(`domain records must define exactly ${PROCEDURE_COUNT} procedures`),
    ),
  )
})

test('rejects a missing domain record file', () => {
  assert.ok(
    checkDomainCatalog({ domainRecords: domainRecords(), missingDomains: ['git'] }).some(
      (failure) => failure.includes('domain procedure record is missing: git.procedures.ts'),
    ),
  )
})

test('rejects a non-canonical domain and an invalid kind', () => {
  const records = domainRecords()
  records[0] = { ...records[0], domain: 'companion' }
  records[1] = { ...records[1], kind: 'subscription' }
  const failures = checkDomainCatalog({ domainRecords: records })
  assert.ok(failures.some((failure) => failure.includes('has a non-canonical domain')))
  assert.ok(failures.some((failure) => failure.includes('has an invalid kind')))
})

function procedureSource({
  catalogImport = "import { procedureCatalog } from '@porcelain/contracts'",
  input = '.input(procedureCatalog.taskList.input)',
  output = '.output(procedureCatalog.taskList.output)',
  kind = 'query',
} = {}) {
  return `${catalogImport}
export const router = t.router({
  taskList: publicProcedure
    ${input}
    ${output}
    .${kind}(() => undefined),
})
`
}

/** One Tasks procedure spread across the full production router file set. */
function routerFixture(options = {}) {
  const tasksSource = procedureSource(options)
  const emptySource = "import { procedureCatalog } from '@porcelain/contracts'\n"
  const routerSources = Object.fromEntries(
    PRODUCTION_ROUTER_FILES.map((filename) => [
      filename,
      filename === 'features/tasks/tasks-router.ts' ? tasksSource : emptySource,
    ]),
  )
  return {
    routerFiles: [...PRODUCTION_ROUTER_FILES],
    routerProcedures: extractRouterProcedures(tasksSource, 'features/tasks/tasks-router.ts'),
    routerSources,
    domainRecords: [
      { domain: 'tasks', name: 'taskList', kind: 'query', source: 'tasks.procedures.ts' },
    ],
  }
}

test('retains each router filename and complete procedure source block', () => {
  const [procedure] = extractRouterProcedures(procedureSource(), 'features/tasks/tasks-router.ts')
  assert.equal(procedure.filename, 'features/tasks/tasks-router.ts')
  assert.match(procedure.block, /procedureCatalog\.taskList\.input/)
  assert.match(procedure.block, /procedureCatalog\.taskList\.output/)
})

test('extracts procedures from a create*Router factory body', () => {
  const factorySource = `import { procedureCatalog } from '@porcelain/contracts'
export function createTasksRouter() {
  return t.router({
    taskList: publicProcedure
      .input(procedureCatalog.taskList.input)
      .output(procedureCatalog.taskList.output)
      .query(() => undefined),
  })
}
`
  const [procedure] = extractRouterProcedures(factorySource, 'features/tasks/tasks-router.ts')
  assert.equal(procedure.name, 'taskList')
  assert.equal(procedure.kind, 'query')
  assert.match(procedure.block, /procedureCatalog\.taskList\.input/)
})

test('accepts a router bound to its exact catalog input and output', () => {
  assert.deepEqual(checkRouterCatalogBinding(routerFixture()), [])
})

test('rejects an unknown router filename and a test file treated as a router', () => {
  const fixture = routerFixture()
  fixture.routerFiles = [...fixture.routerFiles, 'unknown.ts', 'router/tasks.contract.test.ts']
  const failures = checkRouterCatalogBinding(fixture)
  assert.ok(failures.some((failure) => failure.includes('unknown production router filename')))
  assert.ok(
    failures.some((failure) =>
      failure.includes(
        'router filename is not a production router file: router/tasks.contract.test.ts',
      ),
    ),
  )
})

test('rejects a missing production router filename', () => {
  const fixture = routerFixture()
  fixture.routerFiles = fixture.routerFiles.filter(
    (filename) => filename !== 'features/remote/remote-router.ts',
  )
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('production router file is missing: features/remote/remote-router.ts'),
    ),
  )
})

test('rejects a catalog identifier not imported directly from the contracts root', () => {
  const fixture = routerFixture({ catalogImport: "import { procedureCatalog } from './local'" })
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes(
        'router must import procedureCatalog directly from @porcelain/contracts: features/tasks/tasks-router.ts',
      ),
    ),
  )
})

test('rejects missing, wrong, and duplicate canonical inputs', () => {
  const cases = [
    { options: { input: '' }, expected: 'router procedure input is missing' },
    {
      options: { input: '.input(procedureCatalog.addTask.input)' },
      expected: 'router procedure input is wrong',
    },
    {
      options: {
        input:
          '.input(procedureCatalog.taskList.input)\n    .input(procedureCatalog.taskList.input)',
      },
      expected: 'router procedure input is duplicated',
    },
  ]
  for (const { options, expected } of cases) {
    assert.ok(
      checkRouterCatalogBinding(routerFixture(options)).some((failure) =>
        failure.includes(expected),
      ),
    )
  }
})

test('rejects missing, wrong, and duplicate canonical outputs', () => {
  const cases = [
    { options: { output: '' }, expected: 'router procedure output is missing' },
    {
      options: { output: '.output(procedureCatalog.addTask.output)' },
      expected: 'router procedure output is wrong',
    },
    {
      options: {
        output:
          '.output(procedureCatalog.taskList.output)\n    .output(procedureCatalog.taskList.output)',
      },
      expected: 'router procedure output is duplicated',
    },
  ]
  for (const { options, expected } of cases) {
    assert.ok(
      checkRouterCatalogBinding(routerFixture(options)).some((failure) =>
        failure.includes(expected),
      ),
    )
  }
})

test('rejects a router procedure with no domain contract record', () => {
  const fixture = routerFixture()
  fixture.domainRecords = []
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('router procedure has no domain contract record: taskList'),
    ),
  )
})

test('rejects a contract procedure absent from every router', () => {
  const fixture = routerFixture()
  fixture.domainRecords = [
    ...fixture.domainRecords,
    { domain: 'tasks', name: 'addTask', kind: 'mutation', source: 'tasks.procedures.ts' },
  ]
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('contract procedure is absent from routers: addTask'),
    ),
  )
})

test('rejects a router kind that drifts from its contract record', () => {
  const fixture = routerFixture({ kind: 'mutation' })
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('procedure kind drift for taskList: router=mutation record=query'),
    ),
  )
})

test('rejects a duplicated router procedure name', () => {
  const fixture = routerFixture()
  fixture.routerProcedures = [...fixture.routerProcedures, ...fixture.routerProcedures]
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('daemon procedure appears more than once: taskList'),
    ),
  )
})

/**
 * Forbidden horizontal paths are asserted as fixture strings here only. Production source must
 * never reference them; the recipe's deletion sweep excludes this lint test file.
 */
test('rejects a router that reaches for a deleted horizontal contract path', () => {
  const deletedPaths = [
    '@porcelain/contracts/procedures',
    'packages/contracts/src/procedures/names',
    'packages/contracts/src/procedure-ledger',
    'packages/contracts/src/router',
  ]
  for (const deletedPath of deletedPaths) {
    const fixture = routerFixture({ catalogImport: `import { procedureIo } from '${deletedPath}'` })
    assert.ok(
      checkRouterCatalogBinding(fixture).some((failure) =>
        failure.includes(
          'router must import procedureCatalog directly from @porcelain/contracts: features/tasks/tasks-router.ts',
        ),
      ),
    )
  }
})

test('accepts a clean checkout without the deleted horizontal router directory', async () => {
  const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'porcelain-procedure-contracts-'))

  try {
    const files = [
      ...PRODUCTION_ROUTER_FILES.map((relativePath) => `apps/daemon/src/${relativePath}`),
      ...DOMAIN_KEYS.map((domain) => `packages/contracts/src/${domain}/${domain}.procedures.ts`),
    ]

    for (const relativePath of files) {
      const target = join(fixtureRoot, relativePath)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, await readFile(join(sourceRoot, relativePath)))
    }

    assert.deepEqual(checkProcedureContracts(fixtureRoot), [])
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})

console.log('lint-procedure-contracts fixtures: ok')
