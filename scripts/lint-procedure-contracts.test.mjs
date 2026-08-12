#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkDomainCatalog,
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
  input = '.input(procedureCatalog.boardCards.input)',
  output = '.output(procedureCatalog.boardCards.output)',
  kind = 'query',
} = {}) {
  return `${catalogImport}
export const router = t.router({
  boardCards: publicProcedure
    ${input}
    ${output}
    .${kind}(() => undefined),
})
`
}

/** One board procedure spread across the full production router file set. */
function routerFixture(options = {}) {
  const boardSource = procedureSource(options)
  const emptySource = "import { procedureCatalog } from '@porcelain/contracts'\n"
  const routerSources = Object.fromEntries(
    PRODUCTION_ROUTER_FILES.map((filename) => [
      filename,
      filename === 'features/board/board-router.ts' ? boardSource : emptySource,
    ]),
  )
  return {
    routerFiles: [...PRODUCTION_ROUTER_FILES],
    routerProcedures: extractRouterProcedures(boardSource, 'features/board/board-router.ts'),
    routerSources,
    domainRecords: [
      { domain: 'board', name: 'boardCards', kind: 'query', source: 'board.procedures.ts' },
    ],
  }
}

test('retains each router filename and complete procedure source block', () => {
  const [procedure] = extractRouterProcedures(procedureSource(), 'features/board/board-router.ts')
  assert.equal(procedure.filename, 'features/board/board-router.ts')
  assert.match(procedure.block, /procedureCatalog\.boardCards\.input/)
  assert.match(procedure.block, /procedureCatalog\.boardCards\.output/)
})

test('extracts procedures from a create*Router factory body', () => {
  const factorySource = `import { procedureCatalog } from '@porcelain/contracts'
export function createBoardRouter() {
  return t.router({
    boardCards: publicProcedure
      .input(procedureCatalog.boardCards.input)
      .output(procedureCatalog.boardCards.output)
      .query(() => undefined),
  })
}
`
  const [procedure] = extractRouterProcedures(factorySource, 'features/board/board-router.ts')
  assert.equal(procedure.name, 'boardCards')
  assert.equal(procedure.kind, 'query')
  assert.match(procedure.block, /procedureCatalog\.boardCards\.input/)
})

test('accepts a router bound to its exact catalog input and output', () => {
  assert.deepEqual(checkRouterCatalogBinding(routerFixture()), [])
})

test('rejects an unknown router filename and a test file treated as a router', () => {
  const fixture = routerFixture()
  fixture.routerFiles = [...fixture.routerFiles, 'unknown.ts', 'router/board.contract.test.ts']
  const failures = checkRouterCatalogBinding(fixture)
  assert.ok(failures.some((failure) => failure.includes('unknown production router filename')))
  assert.ok(
    failures.some((failure) =>
      failure.includes(
        'router filename is not a production router file: router/board.contract.test.ts',
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
        'router must import procedureCatalog directly from @porcelain/contracts: features/board/board-router.ts',
      ),
    ),
  )
})

test('rejects missing, wrong, and duplicate canonical inputs', () => {
  const cases = [
    { options: { input: '' }, expected: 'router procedure input is missing' },
    {
      options: { input: '.input(procedureCatalog.addBoardCard.input)' },
      expected: 'router procedure input is wrong',
    },
    {
      options: {
        input:
          '.input(procedureCatalog.boardCards.input)\n    .input(procedureCatalog.boardCards.input)',
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
      options: { output: '.output(procedureCatalog.addBoardCard.output)' },
      expected: 'router procedure output is wrong',
    },
    {
      options: {
        output:
          '.output(procedureCatalog.boardCards.output)\n    .output(procedureCatalog.boardCards.output)',
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
      failure.includes('router procedure has no domain contract record: boardCards'),
    ),
  )
})

test('rejects a contract procedure absent from every router', () => {
  const fixture = routerFixture()
  fixture.domainRecords = [
    ...fixture.domainRecords,
    { domain: 'board', name: 'addBoardCard', kind: 'mutation', source: 'board.procedures.ts' },
  ]
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('contract procedure is absent from routers: addBoardCard'),
    ),
  )
})

test('rejects a router kind that drifts from its contract record', () => {
  const fixture = routerFixture({ kind: 'mutation' })
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('procedure kind drift for boardCards: router=mutation record=query'),
    ),
  )
})

test('rejects a duplicated router procedure name', () => {
  const fixture = routerFixture()
  fixture.routerProcedures = [...fixture.routerProcedures, ...fixture.routerProcedures]
  assert.ok(
    checkRouterCatalogBinding(fixture).some((failure) =>
      failure.includes('daemon procedure appears more than once: boardCards'),
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
          'router must import procedureCatalog directly from @porcelain/contracts: features/board/board-router.ts',
        ),
      ),
    )
  }
})

console.log('lint-procedure-contracts fixtures: ok')
