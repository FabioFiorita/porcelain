#!/usr/bin/env node
/**
 * Fixture tests for the test-shape analyzer.
 *
 * A detector for hollow tests that is itself untested would be the joke writing itself. Each
 * fixture is the smallest source that must be caught — and, just as important, the smallest
 * legitimate source that must NOT be, because a shape check that cries wolf gets ignored and
 * then deleted.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeTestFile } from './test-shape.mjs'

const kinds = (source, fileName = 'fixture.test.ts') =>
  analyzeTestFile(fileName, source).findings.map((finding) => finding.kind)

test('flags a test that reaches no assertion', () => {
  assert.deepEqual(
    kinds(`it('does a thing', () => {
      doTheThing()
    })`),
    ['no-assert'],
  )
})

test('accepts a test that asserts through a file-local helper', () => {
  assert.deepEqual(
    kinds(`function expectRendered(node) {
      expect(node).toHaveTextContent('ok')
    }
    it('renders', () => {
      expectRendered(render())
    })`),
    [],
  )
})

test('accepts an arrow-function local helper too', () => {
  assert.deepEqual(
    kinds(`const expectRendered = (node) => {
      expect(node).toEqual({ ok: true })
    }
    it('renders', () => {
      expectRendered(render())
    })`),
    [],
  )
})

test('accepts an explicit assertion contract with no inline matcher', () => {
  assert.deepEqual(
    kinds(`it('rejects', async () => {
      expect.assertions(1)
      await run().catch((error) => {
        expect(error.message).toBe('boom')
      })
    })`),
    [],
  )
})

test('flags a literal compared to itself', () => {
  assert.deepEqual(
    kinds(`it('absorbs', () => {
      expect(true).toBe(true)
    })`),
    ['tautology'],
  )
})

test('does not call a literal compared to a different literal a tautology', () => {
  assert.deepEqual(
    kinds(`it('computes', () => {
      expect(add(1, 2)).toBe(3)
    })`),
    [],
  )
})

test('flags skip, todo, and xit as disabled', () => {
  assert.deepEqual(kinds(`it.skip('later', () => { expect(1).toBe(1) })`), ['disabled'])
  assert.deepEqual(kinds(`it.todo('someday')`), ['disabled'])
  assert.deepEqual(kinds(`xit('legacy', () => { expect(a).toBe(b) })`), ['disabled'])
})

test('flags a test inside a skipped suite', () => {
  assert.deepEqual(
    kinds(`describe.skip('suite', () => {
      it('inner', () => { expect(a).toBe(b) })
    })`),
    ['disabled'],
  )
})

test('flags .only, which silently skips every sibling', () => {
  assert.deepEqual(kinds(`it.only('focused', () => { expect(a).toBe(b) })`), ['focused'])
})

test('flags a test whose only assertions are existence checks', () => {
  assert.deepEqual(
    kinds(`it('builds something', () => {
      expect(build()).toBeDefined()
      expect(build().parts).toBeTruthy()
    })`),
    ['weak-only'],
  )
})

test('accepts a weak assertion standing beside a real one', () => {
  assert.deepEqual(
    kinds(`it('builds something', () => {
      const result = build()
      expect(result).toBeDefined()
      expect(result.name).toBe('porcelain')
    })`),
    [],
  )
})

test('accepts a port assertion as real proof', () => {
  // For a port-shaped unit the call IS the observable behaviour. There was a `mock-only` kind
  // that flagged this; measuring it found 54 correct tests and zero defects, so it was deleted.
  assert.deepEqual(
    kinds(`it('delegates to the port', () => {
      operate()
      expect(port.write).toHaveBeenCalledWith('payload')
    })`),
    [],
  )
})

test('stays quiet when the proof is delegated to a helper', () => {
  // A helper's assertions are invisible here, so the visible matchers are only part of the
  // proof — calling one disqualifies the weak/mock verdicts, not just no-assert.
  assert.deepEqual(
    kinds(`function expectRejected(error) {
      expect(error.code).toBe('request.invalid')
    }
    it('rejects before dispatching', () => {
      expectRejected(run())
      expect(port.write).not.toHaveBeenCalled()
    })`),
    [],
  )
})

test('accepts a mock assertion paired with an observable result', () => {
  assert.deepEqual(
    kinds(`it('delegates and returns', () => {
      const result = operate()
      expect(port.write).toHaveBeenCalledWith('payload')
      expect(result).toEqual({ ok: true })
    })`),
    [],
  )
})

test('treats a negated weak matcher as a real assertion', () => {
  // `not.toHaveBeenCalled()` pins that a specific thing did not happen — the assertion that
  // catches over-eager behaviour. Only the un-negated form is hollow.
  assert.deepEqual(
    kinds(`it('ignores mouse pointers', () => {
      drive()
      expect(scrollLines).not.toHaveBeenCalled()
    })`),
    [],
  )
  assert.deepEqual(
    kinds(`it('reports nothing', () => {
      run()
      expect(observer).toHaveBeenCalled()
    })`),
    ['weak-only'],
  )
})

test('counts a negated strong matcher beside a weak one', () => {
  assert.deepEqual(
    kinds(`it('busts the memo', () => {
      expect(second).not.toBe(first)
      expect(fileAt(second, 'b.ts')).toBeDefined()
    })`),
    [],
  )
})

test('does not call a throwing Testing Library query weak', () => {
  // `getByRole` fails the test by itself when the element is absent, so the weak matcher around
  // it is noise, not a hollow proof.
  assert.deepEqual(
    kinds(`it('renders the button', () => {
      expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy()
    })`),
    [],
  )
})

test('still flags a weak matcher on a non-throwing query', () => {
  // `queryByRole` returns null instead of throwing, so here the matcher is the whole assertion.
  assert.deepEqual(
    kinds(`it('renders the button', () => {
      expect(screen.queryByRole('button', { name: 'Commit' })).toBeTruthy()
    })`),
    ['weak-only'],
  )
})

test('counts a type-level assertion as an assertion', () => {
  assert.deepEqual(
    kinds(`it('pins the union', () => {
      expectTypeOf<ReadError>().toEqualTypeOf<'path-outside-project'>()
    })`),
    [],
  )
})

test('walks it.each and tagged titles without losing the body', () => {
  assert.deepEqual(
    kinds(`it.each([1, 2])('case %i', (n) => {
      runCase(n)
    })`),
    ['no-assert'],
  )
})

test('handles tsx and counts every test in a file', () => {
  const result = analyzeTestFile(
    'fixture.test.tsx',
    `it('a', () => { expect(<div />).toBeInTheDocument() })
     it('b', () => { render(<div />) })`,
  )
  assert.equal(result.testCount, 2)
  assert.deepEqual(
    result.findings.map((finding) => finding.kind),
    ['no-assert'],
  )
})

test('reports the title and line so a finding can be opened', () => {
  const [finding] = analyzeTestFile(
    'fixture.test.ts',
    `\n\nit('a hollow one', () => {\n  run()\n})`,
  ).findings
  assert.equal(finding.title, 'a hollow one')
  assert.equal(finding.line, 3)
  assert.equal(finding.file, 'fixture.test.ts')
})
