#!/usr/bin/env node
/**
 * Ban SwiftUI virtual views mounted into a UIKit view.
 *
 * Everything `@expo/ui/swift-ui` exports except `Host` and `RNHostView` is a
 * *virtual* view: an NSObject a SwiftUI tree reads, not a UIView. Mount one
 * under a real UIView and expo-modules-core throws from
 * `-[SwiftUIVirtualViewObjC forwardingTargetForSelector:]`, aborting the app —
 * a runtime-only crash, because the tree is legal TypeScript and legal React.
 *
 * Two shapes are decidable inside one file, and both are the crash verbatim:
 *
 *   1. A virtual view that is a *sibling* of a `Host`/`ScreenHost`. A Host in a
 *      children list proves the surrounding parent is UIKit, so the sibling has
 *      no SwiftUI parent to attach to.
 *   2. A virtual view directly under `RNHostView` or a `react-native` element.
 *      Those are UIViews by construction.
 *
 * A virtual root handed across a file boundary is not decidable here.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SCAN = join(root, 'apps', 'mobile', 'src')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.expo', 'ios', 'android'])

const SWIFT_UI = '@expo/ui/swift-ui'
/** Real UIViews that `@expo/ui/swift-ui` exports — the boundary, not the content. */
const HOSTS = new Set(['Host'])
const RN_HOSTS = new Set(['RNHostView'])

function importedFrom(sf) {
  const bindings = new Map()
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue
    const spec = statement.moduleSpecifier.text
    const named = statement.importClause?.namedBindings
    if (named === undefined || !ts.isNamedImports(named)) continue
    for (const element of named.elements) bindings.set(element.name.text, spec)
  }
  return bindings
}

function tagOf(node) {
  const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName
  return ts.isIdentifier(tag) ? tag.text : null
}

/**
 * The elements React mounts as this node's children, looking through expression
 * containers (`{cond ? <X /> : null}`, `{list.map(…)}`) so a conditional sibling
 * counts, but stopping at each element found — deeper ones are its children.
 */
function childElements(node) {
  const out = []
  const push = (expr) => {
    const visit = (inner) => {
      if (ts.isJsxFragment(inner)) {
        out.push(...childElements(inner))
        return
      }
      if (ts.isJsxElement(inner) || ts.isJsxSelfClosingElement(inner)) {
        out.push(inner)
        return
      }
      ts.forEachChild(inner, visit)
    }
    visit(expr)
  }
  for (const child of node.children) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) out.push(child)
    else if (ts.isJsxExpression(child) && child.expression !== undefined) push(child.expression)
  }
  return out
}

export function findViolations(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = importedFrom(sf)
  const from = (name) => (name === null ? undefined : imports.get(name))
  const isHost = (name) =>
    (from(name) === SWIFT_UI && HOSTS.has(name)) || /screen-host$/.test(from(name) ?? '')
  const isReactNative = (name) => from(name) === 'react-native'
  const isRnHost = (name) => from(name) === SWIFT_UI && RN_HOSTS.has(name)
  const isVirtual = (name) => from(name) === SWIFT_UI && !HOSTS.has(name) && !RN_HOSTS.has(name)

  const hits = []
  const report = (element, reason) => {
    const { line } = sf.getLineAndCharacterOfPosition(element.getStart(sf))
    hits.push({ line: line + 1, reason, tag: tagOf(element) })
  }

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const kids = childElements(node)
      const parent = ts.isJsxFragment(node) ? null : tagOf(node)
      if (kids.some((kid) => isHost(tagOf(kid)))) {
        for (const kid of kids) {
          if (isVirtual(tagOf(kid))) report(kid, 'sits beside a Host instead of inside it')
        }
      }
      if (isRnHost(parent) || isReactNative(parent)) {
        for (const kid of kids) {
          if (isVirtual(tagOf(kid))) report(kid, `is mounted directly inside <${parent}>`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

function selfCheck() {
  const swift = "import { Form, ConfirmationDialog, Text, Host } from '@expo/ui/swift-ui'\n"
  const host = "import { ScreenHost } from '@/components/screen-host'\n"
  const rn = "import { View } from 'react-native'\n"
  const cases = [
    [
      'dialog beside the host',
      `${swift}${host}const A = () => (<><ScreenHost><Form /></ScreenHost><ConfirmationDialog /></>)\n`,
      1,
    ],
    [
      'dialog inside the host',
      `${swift}${host}const A = () => (<ScreenHost><Form /><ConfirmationDialog /></ScreenHost>)\n`,
      0,
    ],
    [
      'conditional sibling of the host',
      `${swift}${host}const A = (b) => (<><ScreenHost><Form /></ScreenHost>{b ? <Text>x</Text> : null}</>)\n`,
      1,
    ],
    [
      'swift text inside an RN view',
      `${swift}${rn}const A = () => (<View><Text>x</Text></View>)\n`,
      1,
    ],
    [
      'host inside an RN view',
      `${swift}${rn}const A = () => (<View><Host><Form /></Host></View>)\n`,
      0,
    ],
  ]
  for (const [label, source, expected] of cases) {
    const got = findViolations('decoy.tsx', source).length
    if (got !== expected) {
      console.error(
        `lint-swiftui-host self-check failed: ${label} expected ${expected}, got ${got}`,
      )
      process.exit(2)
    }
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(path)
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
  console.error('SwiftUI views mounted into UIKit — these abort the app at mount:\n')
  for (const h of hits) console.error(`  ${h.file}:${h.line}  <${h.tag}> ${h.reason}`)
  console.error(
    `\n${hits.length} hit(s). Move each one inside the SwiftUI tree its Host owns; wrap RN children in <RNHostView>.`,
  )
  process.exit(1)
}

console.log('lint-swiftui-host: ok')
