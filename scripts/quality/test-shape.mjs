#!/usr/bin/env node
/**
 * Find tests that pass without proving anything.
 *
 * Coverage cannot see this class of defect: a test that renders a component and asserts nothing,
 * or asserts only that a mock was called, executes every line it touches and reports as covered.
 * It is worse than no test, because it reports as safe.
 *
 * What this reads, per test body:
 *
 *   disabled    `.skip` / `.todo` / `xit` — a test nobody has run in months
 *   focused     `.only` — silently skips every sibling in the file
 *   no-assert   zero assertions reached, directly or through a local helper
 *   weak-only   every assertion is `toBeDefined` / `toBeTruthy` / bare `toHaveBeenCalled`
 *   tautology   `expect(true).toBe(true)` and friends — always green
 *
 * There was a `mock-only` kind too — every assertion inspecting a test double. It was deleted
 * after measuring it: all 54 findings pinned arguments or a call count, and none were the bare
 * `toHaveBeenCalled()` that `weak-only` already catches. For a port-shaped unit ("150 dirs → 150
 * watchers") the call count IS the observable behaviour, so the kind reported 54 correct tests
 * and zero defects. A report that is mostly wrong teaches people to skip the report.
 *
 * This is a *shape* check, and shape is a proxy. It cannot see the failure the human actually
 * described — a spec that passes because a sibling left the fixture in the wrong state — because
 * that needs the semantics. Mutation testing owns that. This owns the cheap, exhaustive half.
 *
 * Measurement only, like the rest of `pnpm quality`. Findings are reviewed, not failed on.
 *
 *   node scripts/quality/test-shape.mjs            # summary
 *   node scripts/quality/test-shape.mjs --list     # every finding
 *   node scripts/quality/test-shape.mjs --gate     # fail on the always-wrong kinds
 *   node scripts/quality/test-shape.mjs --json
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const SCAN_ROOTS = [
  'apps/daemon/src',
  'apps/web/src',
  'apps/desktop/src',
  'apps/mobile/src',
  'packages/contracts/src',
  'packages/client-runtime/src',
  'packages/shared/src',
]

/** Matchers that pin a value, a shape, an error, or observable DOM state. */
const STRONG_MATCHERS = new Set([
  'toBe',
  'toEqual',
  'toStrictEqual',
  'toMatch',
  'toMatchObject',
  'toContain',
  'toContainEqual',
  'toHaveLength',
  'toHaveProperty',
  'toBeCloseTo',
  'toBeGreaterThan',
  'toBeGreaterThanOrEqual',
  'toBeLessThan',
  'toBeLessThanOrEqual',
  'toBeNull',
  'toBeUndefined',
  'toBeNaN',
  'toThrow',
  'toThrowError',
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toMatchFileSnapshot',
  'toHaveValue',
  'toHaveTextContent',
  'toHaveAttribute',
  'toHaveClass',
  'toHaveStyle',
  'toHaveFocus',
  'toBeInTheDocument',
  'toBeVisible',
  'toBeDisabled',
  'toBeEnabled',
  'toBeChecked',
  'toHaveBeenCalledWith',
  'toHaveBeenCalledTimes',
  'toHaveBeenNthCalledWith',
  'toHaveBeenLastCalledWith',
  'toHaveReturnedWith',
  // `expectTypeOf(...)` / `assertType(...)` — enforced by tsc over the test project.
  'toEqualTypeOf',
  'toMatchTypeOf',
  'toExtend',
  'assertType',
])

/**
 * Matchers that only prove something exists. Useful as a guard beside a real assertion,
 * hollow as the entire proof of a test.
 */
const WEAK_MATCHERS = new Set([
  'toBeDefined',
  'toBeTruthy',
  'toBeFalsy',
  'toBeInstanceOf',
  'toBeTypeOf',
  'toHaveBeenCalled',
  'toHaveReturned',
  'toBeCalled',
])

const TEST_NAMES = new Set(['it', 'test', 'fit', 'xit', 'xtest'])
const SUITE_NAMES = new Set(['describe', 'xdescribe', 'fdescribe'])
const SKIP_DIRS = new Set([
  '.stryker-tmp',
  'node_modules',
  'out',
  'dist',
  'build',
  'coverage',
  '.expo',
])

function walk(directory, output = []) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(directory, entry.name), output)
    } else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) {
      output.push(path.join(directory, entry.name))
    }
  }
  return output
}

/**
 * Peel `a.b.c` / `a.each([...])(...)` down to the identifier it hangs off, collecting the
 * property names on the way. `it.skip('x')` yields `{ base: 'it', modifiers: ['skip'] }`.
 */
function unwrapCallee(expression) {
  const modifiers = []
  let current = expression
  for (;;) {
    if (ts.isPropertyAccessExpression(current)) {
      modifiers.unshift(current.name.text)
      current = current.expression
      continue
    }
    // `it.each([...])('name', fn)` — the callee is itself a call.
    if (ts.isCallExpression(current)) {
      current = current.expression
      continue
    }
    if (ts.isIdentifier(current)) return { base: current.text, modifiers }
    return { base: null, modifiers }
  }
}

/** The trailing function argument a test or suite runs. */
function callbackOf(node) {
  for (let index = node.arguments.length - 1; index >= 0; index -= 1) {
    const argument = node.arguments[index]
    if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) return argument
  }
  return null
}

function titleOf(node) {
  const first = node.arguments[0]
  if (first === undefined) return '<untitled>'
  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) return first.text
  if (ts.isTemplateExpression(first)) return first.head.text.concat('…')
  return '<computed>'
}

/**
 * Every matcher name reached from an `expect(...)` inside this node, plus whether the body
 * called `expect.assertions` / `expect.hasAssertions` (an explicit assertion contract) and
 * whether any assertion is a literal-vs-same-literal tautology.
 */
function collectAssertions(node) {
  const matchers = []
  let declaresAssertions = false
  let tautology = false
  let throwingQuery = false

  const visit = (current) => {
    if (ts.isCallExpression(current)) {
      const { base, modifiers } = unwrapCallee(current.expression)
      // Type-level assertions are real assertions; they fail at typecheck, not at runtime.
      if (base === 'expectTypeOf' || base === 'assertType') {
        matchers.push(modifiers[modifiers.length - 1] ?? 'assertType')
      }
      if (base === 'expect' && modifiers.length > 0) {
        const matcher = modifiers[modifiers.length - 1]
        if (matcher === 'assertions' || matcher === 'hasAssertions') {
          declaresAssertions = true
        } else if (modifiers.includes('not')) {
          // Negation flips strength. `toHaveBeenCalled()` says "something happened" and proves
          // little; `not.toHaveBeenCalled()` says this exact thing did not happen, which is the
          // assertion that catches over-eager behaviour. Same for `not.toBeDefined()`.
          matchers.push(`not.${matcher}`)
        } else {
          matchers.push(matcher)
        }

        // `expect(<literal>).toBe(<identical literal>)` can never fail.
        const subject = findExpectSubject(current.expression)
        if (isThrowingQuery(subject)) throwingQuery = true
        const argument = current.arguments[0]
        if (
          subject !== null &&
          argument !== undefined &&
          isLiteralish(subject) &&
          isLiteralish(argument) &&
          subject.getText() === argument.getText()
        ) {
          tautology = true
        }
      }
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return { matchers, declaresAssertions, tautology, throwingQuery }
}

/**
 * Whether `expect(...)`'s subject is a Testing Library query that throws on a miss.
 *
 * `screen.getByRole('button')` fails the test by itself when the button is absent, so
 * `expect(...).toBeTruthy()` around it is noise rather than a hollow proof. `queryBy*` is the
 * opposite — it returns null, so a weak matcher there really is the whole assertion.
 */
function isThrowingQuery(node) {
  if (node === null || node === undefined) return false
  let current = node
  if (ts.isAwaitExpression(current)) current = current.expression
  if (!ts.isCallExpression(current)) return false
  const callee = current.expression
  const name = ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : ts.isIdentifier(callee)
      ? callee.text
      : ''
  return /^(?:get|find)(?:All)?By[A-Z]/.test(name)
}

/** The `x` in `expect(x).not.toBe(...)`, reached through however many property accesses. */
function findExpectSubject(expression) {
  let current = expression
  while (ts.isPropertyAccessExpression(current)) current = current.expression
  if (ts.isCallExpression(current) && ts.isIdentifier(current.expression)) {
    if (current.expression.text === 'expect') return current.arguments[0] ?? null
  }
  return null
}

function isLiteralish(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  )
}

/**
 * Names of file-local functions whose bodies assert. A test delegating to `expectRowRendered()`
 * is asserting; without this the no-assertion count is mostly false positives.
 */
function localAssertingHelpers(sourceFile) {
  const helpers = new Set()
  const consider = (name, body) => {
    if (name === undefined || body === null || body === undefined) return
    if (collectAssertions(body).matchers.length > 0) helpers.add(name)
  }
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      consider(node.name.text, node.body)
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer
      if (
        initializer !== undefined &&
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      ) {
        consider(node.name.text, initializer.body)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return helpers
}

function callsAnyHelper(node, helpers) {
  if (helpers.size === 0) return false
  let found = false
  const visit = (current) => {
    if (found) return
    if (ts.isCallExpression(current)) {
      const { base, modifiers } = unwrapCallee(current.expression)
      if (modifiers.length === 0 && base !== null && helpers.has(base)) {
        found = true
        return
      }
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

/** Analyze one test file. Exported for the fixture tests. */
export function analyzeTestFile(fileName, sourceText) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const helpers = localAssertingHelpers(sourceFile)
  const findings = []
  let testCount = 0

  const lineOf = (node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const visit = (node, suiteDisabled) => {
    if (ts.isCallExpression(node)) {
      const { base, modifiers } = unwrapCallee(node.expression)

      if (base !== null && SUITE_NAMES.has(base)) {
        const disabled =
          suiteDisabled ||
          base === 'xdescribe' ||
          modifiers.some((m) => m === 'skip' || m === 'todo')
        const callback = callbackOf(node)
        if (callback !== null) {
          ts.forEachChild(callback, (child) => {
            visit(child, disabled)
          })
          return
        }
      }

      if (base !== null && TEST_NAMES.has(base)) {
        testCount += 1
        const report = (kind, detail) => {
          findings.push({ kind, file: fileName, line: lineOf(node), title: titleOf(node), detail })
        }

        const disabled =
          suiteDisabled ||
          base === 'xit' ||
          base === 'xtest' ||
          modifiers.some((m) => m === 'skip' || m === 'todo')
        if (modifiers.includes('only') || base === 'fit') {
          report('focused', 'runs alone; every sibling in the file is skipped')
        }
        if (disabled) {
          report('disabled', 'never runs')
          return
        }

        const callback = callbackOf(node)
        if (callback === null) {
          report('disabled', 'declared with no body')
          return
        }

        const { matchers, declaresAssertions, tautology, throwingQuery } =
          collectAssertions(callback)
        if (tautology) report('tautology', 'compares a literal to itself; cannot fail')

        // A test delegating to `expectPublicCode(...)` is asserting, and what that helper checks
        // is invisible here — so it disqualifies the weak/mock verdicts too, not just no-assert.
        const delegates = callsAnyHelper(callback, helpers) || throwingQuery

        if (matchers.length === 0) {
          if (!declaresAssertions && !delegates) {
            report('no-assert', 'reaches no assertion')
          }
        } else if (delegates || declaresAssertions) {
          // Nothing to say: the visible matchers are only part of the proof.
        } else {
          // Any `not.` matcher is a precise claim, whichever matcher it negates.
          const strong = matchers.filter((m) => m.startsWith('not.') || STRONG_MATCHERS.has(m))
          const weak = matchers.filter((m) => WEAK_MATCHERS.has(m))
          if (strong.length === 0 && weak.length > 0) {
            report('weak-only', `only ${[...new Set(weak)].join(', ')}`)
          }
        }
        return
      }
    }
    ts.forEachChild(node, (child) => {
      visit(child, suiteDisabled)
    })
  }

  visit(sourceFile, false)
  return { testCount, findings }
}

/** Scan every test file under the configured roots. Exported for the fixture tests. */
export function scanTestShape(baseDirectory) {
  const findings = []
  let testCount = 0
  let fileCount = 0
  for (const scanRoot of SCAN_ROOTS) {
    for (const absolute of walk(path.join(baseDirectory, scanRoot))) {
      const relative = path.relative(baseDirectory, absolute).split(path.sep).join('/')
      const result = analyzeTestFile(relative, readFileSync(absolute, 'utf8'))
      fileCount += 1
      testCount += result.testCount
      findings.push(...result.findings)
    }
  }
  return { fileCount, testCount, findings }
}

/**
 * Kinds with no defensible instance. A focused test hides its siblings, a disabled one is not a
 * test, a tautology cannot fail, a body that reaches no assertion proves nothing while reporting
 * as covered, and a `weak-only` body claims something exists without saying what it is.
 *
 * `weak-only` joined the list only once it stopped crying wolf. It started at 48 findings, of
 * which nearly all were the detector's fault: a test delegating to a local `expect…` helper, a
 * `getBy*` query that throws on a miss and is therefore its own assertion, and `not.` negations,
 * which are precise claims rather than vague ones. With those understood the real count was two,
 * both fixed. All five kinds measure zero; the gate exists so they stay there.
 */
export const GATED_KINDS = ['focused', 'disabled', 'tautology', 'no-assert', 'weak-only']

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2))
  const result = scanTestShape(root)

  if (args.has('--gate')) {
    const violations = result.findings.filter((finding) => GATED_KINDS.includes(finding.kind))
    if (violations.length > 0) {
      for (const finding of violations) {
        process.stderr.write(
          `${finding.file}:${finding.line} [${finding.kind}] "${finding.title}" — ${finding.detail}\n`,
        )
      }
      process.stderr.write(
        `\nlint-test-shape: ${violations.length} test(s) that cannot fail. ` +
          `Write the assertion, or delete the test — do not skip it.\n`,
      )
      process.exit(1)
    }
    process.stdout.write(
      `lint-test-shape: ok — ${result.testCount} tests across ${result.fileCount} files\n`,
    )
    process.exit(0)
  }

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    const byKind = {}
    for (const finding of result.findings) {
      const group = byKind[finding.kind] ?? []
      group.push(finding)
      byKind[finding.kind] = group
    }
    const order = ['focused', 'tautology', 'no-assert', 'disabled', 'weak-only']
    const out = ['', '  TEST SHAPE', `  ${'─'.repeat(60)}`]
    out.push(`  ${result.testCount} tests across ${result.fileCount} files`)
    out.push('')
    for (const kind of order) {
      const group = byKind[kind] ?? []
      out.push(`  ${kind.padEnd(12)} ${group.length.toString().padStart(4)}`)
      const shown = args.has('--list') ? group : group.slice(0, 3)
      for (const finding of shown) {
        out.push(`      ${finding.file}:${finding.line}`)
        out.push(`        "${finding.title}" — ${finding.detail}`)
      }
      if (!args.has('--list') && group.length > shown.length) {
        out.push(`      … ${group.length - shown.length} more (--list)`)
      }
    }
    out.push('')
    out.push('  Shape is a proxy. weak-only is a prompt to look, not a verdict; focused,')
    out.push('  tautology, disabled, and no-assert are defects on sight.')
    out.push('')
    process.stdout.write(out.join('\n'))
  }
}
