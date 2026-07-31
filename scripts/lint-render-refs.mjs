#!/usr/bin/env node
/**
 * Ban ref writes during render.
 *
 * `someRef.current = x` is correct inside an effect, a callback, or an event
 * handler. Written straight in a component or `use*` hook body it runs on every
 * render — including renders React throws away — so the ref and the rendered
 * output can disagree, and concurrent rendering makes it non-deterministic.
 *
 * Indentation cannot tell the two apart, so this walks the TypeScript AST: for
 * each `<expr>.current = …`, find the nearest enclosing function. If that
 * function is a component or a hook, the write is at render scope. If it is the
 * arrow passed to `useEffect` (or any other nested function), it is fine.
 *
 * React has no lint rule for this and Biome has none either, which is why it is
 * here rather than in `biome.json`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SCAN = join(root, 'src', 'renderer', 'src')
const VENDORED_UI = join(SCAN, 'components', 'ui')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out'])

const isFunctionLike = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node)

/** A component (PascalCase) or a hook (`use…`) — both bodies run during render. */
const rendersOnCall = (name) => /^[A-Z]/.test(name) || /^use[A-Z]/.test(name)

function enclosingFunctionName(node) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (!isFunctionLike(cur)) continue
    if (cur.name && ts.isIdentifier(cur.name)) return cur.name.text
    // `const Foo = () => {}` / `const useFoo = function () {}`
    if (cur.parent && ts.isVariableDeclaration(cur.parent) && ts.isIdentifier(cur.parent.name)) {
      return cur.parent.name.text
    }
    return null // an anonymous nested function: a callback, so not render scope
  }
  return null
}

export function findViolations(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const hits = []
  const visit = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'current'
    ) {
      const owner = enclosingFunctionName(node)
      if (owner !== null && rendersOnCall(owner)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        hits.push({ line: line + 1, owner, text: node.getText(sf).split('\n')[0].slice(0, 90) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

function selfCheck() {
  const bad = 'function Foo() {\n  const r = useRef(0)\n  r.current = 1\n  return null\n}\n'
  const inEffect =
    'function Foo() {\n  const r = useRef(0)\n  useEffect(() => {\n    r.current = 1\n  })\n  return null\n}\n'
  const inHook = 'function useThing() {\n  const r = useRef(0)\n  r.current = 1\n}\n'
  const handler =
    'function Foo() {\n  const r = useRef(0)\n  const onTap = () => {\n    r.current = 1\n  }\n  return null\n}\n'
  const cases = [
    ['render-scope write', bad, 1],
    ['write inside useEffect', inEffect, 0],
    ['render-scope write in a hook', inHook, 1],
    ['write inside a named handler', handler, 0],
  ]
  for (const [label, source, expected] of cases) {
    const got = findViolations('decoy.tsx', source).length
    if (got !== expected) {
      console.error(`lint-render-refs self-check failed: ${label} expected ${expected}, got ${got}`)
      process.exit(2)
    }
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (path === VENDORED_UI) continue
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

selfCheck()

const hits = []
for (const file of walk(SCAN)) {
  for (const hit of findViolations(file, readFileSync(file, 'utf8'))) {
    hits.push({ file: relative(root, file), ...hit })
  }
}

if (hits.length > 0) {
  console.error('Ref writes during render — move these into an effect or a callback:\n')
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  in ${h.owner}()`)
    console.error(`    ${h.text}`)
  }
  console.error(
    `\n${hits.length} hit(s). For a value an effect should mirror, write it in a sync effect declared before its readers; for a callback, use useEffectEvent.`,
  )
  process.exit(1)
}

console.log('lint-render-refs: ok')
