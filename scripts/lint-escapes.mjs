#!/usr/bin/env node
/**
 * Escape-hatch bans Biome cannot express alone — `noExplicitAny` covers `any`, nothing
 * covers a double cast by itself, and the house promise rule is stricter than Biome's
 * floating-promise disposition that still accepts `void promise`.
 *
 * Scanned ownership roots (tracked TypeScript/JavaScript under each):
 *   apps/web, apps/daemon, apps/desktop, apps/mobile, packages/*, scripts
 *
 * Repo-wide:
 *   - `as unknown as` — change the design or use a structural interface (production
 *     exceptions are forbidden; ALLOWED_FILES is only for external platform doubles
 *     that structural typing cannot express reasonably in unit tests).
 *   - `void` on a promise / expression — banned. Use await/return, Promise.all,
 *     a complete then/catch chain, or a named synchronous background boundary that
 *     always attaches .catch (e.g. settleBackground / runUserAction).
 *   - Bare floating Promise-returning calls (AST): expression-statement calls to
 *     known promise methods (mutateAsync, invalidateQueries, …) or *Async callees,
 *     unless awaited/returned/Promise.all/complete catch/named boundary.
 *   - No-op rejection handlers anywhere (AST): `.catch(() => {})`, `.catch(() => undefined)`,
 *     a comment-only catch body, and `.then(ok, () => {})`. A silent settle must say why —
 *     `settleBackground(promise, reason)` — or own the error for real. A no-op catch also
 *     stops counting as disposition, so the promise under it is still floating.
 *   - Async / Promise-returning JSX & object event handlers (AST): every JSX onX
 *     (including onError/onStatusChange — no library exclusions in JSX), object onX
 *     except React Query/transport lifecycle keys, inline async, scope-resolved
 *     async/Promise/imported identifiers, and addEventListener async/Promise callbacks.
 *     Handler BODIES are inspected too: `onClick={() => f(x)}` and `onClick={() => { f(x) }}`
 *     fail when `f` is Promise-returning, so the wrapper idiom proves something.
 *     Frameworks ignore returned promises.
 *   - Syntactic no-op error handlers passed to runUserAction (AST).
 *
 * Resolution is import-aware but checker-free: an import specifier is resolved to a file
 * through the alias table below, and that module's DECLARED signatures answer what a hook
 * hands back. So `const { stageFile } = useFileStaging()` and `const [save] = useSaver()`
 * both carry their real disposition to the event edge. The boundary names
 * (settleBackground / runUserAction) only disarm the rule when they resolve to
 * BOUNDARY_MODULE_REL — a same-named local decoy disarms nothing.
 *
 * Mobile only (apps/mobile/src):
 *   - universal `@expo/ui` root import
 *   - terminal hex palette outside terminal-theme.ts
 *   - second trailing Stack.Toolbar on screens that already render HeaderToolbar
 *
 * Comment lines are skipped. ALLOWED_FILES entries must exist on disk.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(scriptDir, '..')

/** Ownership roots relative to the repository root. Missing roots fail the gate. */
export const SCAN_ROOTS = [
  'apps/web/src',
  'apps/daemon/src',
  'apps/desktop/src',
  'apps/mobile/src',
  'packages/client-runtime/src',
  'packages/contracts/src',
  'packages/shared/src',
  'packages/ui/src',
  'scripts',
]

export const FORBIDDEN = [
  {
    re: /\bas\s+unknown\s+as\b/,
    label: 'as unknown as (change the design or use a structural interface)',
  },
  {
    // Identifier form: void foo( / void foo.bar(
    // Parenthesized form: void (async () => {})() / void (maybe as Promise).then(
    re: /\bvoid\s+(?:[a-zA-Z_$][a-zA-Z0-9_$]*[.(]|\()/,
    label:
      'void on a promise (await/return it, aggregate with Promise.all, complete then/catch, or settleBackground(promise) — never strip void and leave the Promise bare)',
  },
]

export const MOBILE_FORBIDDEN = [
  {
    re: /(?:from|require\()\s*['"]@expo\/ui['"]/,
    label:
      'universal @expo/ui root import (rule 5: the native client is SwiftUI-only — import components from @expo/ui/swift-ui and modifiers from @expo/ui/swift-ui/modifiers, Host included)',
  },
]

/**
 * The terminal is the one surface that cannot take its colours from the design tokens: a shell
 * paints with ANSI, so the pane, its chrome and every escape sequence have to resolve against
 * ONE palette. A hex literal loose in the feature is how the frame came to paint a black border
 * around a white terminal in light appearance — the emulator followed the appearance and the
 * chrome followed nothing.
 *
 * `terminal-theme.ts` IS that palette (it is deliberately byte-identical to the desktop
 * client's, so one PTY looks the same on both), which is why it is the one file allowed to
 * write the values down.
 */
const TERMINAL_PALETTE_FILE = 'terminal-theme.ts'
export const TERMINAL_FORBIDDEN = [
  {
    re: /#[0-9a-fA-F]{3,8}\b/,
    label:
      'hardcoded colour in the terminal feature (take it from TERMINAL_PALETTES in ./terminal-theme — a literal here silently disagrees with the palette the emulator paints with)',
  },
]

/**
 * One trailing toolbar per screen. A screen-level `Stack.Toolbar placement="right"` does NOT
 * merge with the one `HeaderToolbar` renders — it replaces it, taking the companion (bolt) and
 * settings buttons with it. That is how the Files tab shipped showing only its options menu.
 * A screen with menu items passes them to `ScreenHeader`/`HeaderToolbar` as `menu`; a screen
 * with no header at all (the terminal session) still owns its toolbar outright.
 */
const TOOLBAR_OWNERS = new Set(['components/header-toolbar.tsx', 'components/screen-header.tsx'])
const RENDERS_HEADER = /<(?:ScreenHeader|HeaderToolbar)\b/
const TRAILING_TOOLBAR = /<Stack\.Toolbar\s+placement="right"/

const SKIP_DIRS = new Set(['.stryker-tmp', 'node_modules', 'dist', 'out', 'fixtures'])
/** Self-referential scanners/tests that intentionally embed the banned patterns as fixtures. */
const SKIP_FILES_REL = new Set(['scripts/lint-escapes.mjs', 'scripts/lint-escapes.test.mjs'])
// Vendored shadcn lives under apps/web; Biome also excludes it. Skip by path when present.
export const VENDORED_UI_REL = 'apps/web/src/components/ui'

/**
 * Exact unit-test files that may double-cast external platform objects (node:http, DOM)
 * when a structural interface cannot express the host type reasonably. Production code
 * must never appear here. Every entry must exist on disk.
 */
export const ALLOWED_FILES_REL = [
  // fakes node:http ServerResponse for HEAD type mapping
  'apps/daemon/src/net/static-server.test.ts',
  // fakes DOM Touch[] for touch-scroll listener wiring
  'apps/web/src/lib/terminal-touch-scroll.test.ts',
  // fakes CanvasRenderingContext2D for ghostty measure/render unit tests
  'apps/web/src/terminal/ghostty/renderer.test.ts',
]

const WALK_EXT = /\.(tsx?|jsx?|mjs)$/

/**
 * @param {string} repositoryRoot
 * @returns {{ absolute: string, relative: string }[]}
 */
export function resolveScanRoots(repositoryRoot) {
  const roots = []
  const missing = []
  for (const rel of SCAN_ROOTS) {
    const absolute = join(repositoryRoot, rel)
    if (!existsSync(absolute)) {
      missing.push(rel)
      continue
    }
    roots.push({ absolute, relative: rel })
  }
  if (missing.length > 0) {
    throw new Error(
      `lint-escapes: missing scan root(s): ${missing.join(', ')} — update SCAN_ROOTS when ownership moves`,
    )
  }
  return roots
}

/**
 * @param {string} repositoryRoot
 * @returns {string[]} absolute paths that are allowlisted
 */
export function resolveAllowedFiles(repositoryRoot) {
  const allowed = []
  const missing = []
  for (const rel of ALLOWED_FILES_REL) {
    const absolute = join(repositoryRoot, rel)
    if (!existsSync(absolute)) {
      missing.push(rel)
      continue
    }
    allowed.push(absolute)
  }
  if (missing.length > 0) {
    throw new Error(
      `lint-escapes: ALLOWED_FILES path(s) missing: ${missing.join(', ')} — update after tree moves`,
    )
  }
  return allowed
}

/**
 * @param {string} dir
 * @param {string | null} skipAbsolute
 * @param {string[]} out
 */
export function walk(dir, skipAbsolute = null, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (skipAbsolute !== null && path === skipAbsolute) continue
    const st = statSync(path)
    if (st.isDirectory()) walk(path, skipAbsolute, out)
    else if (WALK_EXT.test(name) && !name.endsWith('.generated.ts')) out.push(path)
  }
  return out
}

/**
 * @param {string} file
 * @param {{ mobileSrcRoot: string, rules: { re: RegExp, label: string }[] }} ctx
 * @returns {{ file: string, line: number, label: string, snippet: string }[]}
 */

/** Methods whose CallExpression as an expression statement is always a floating promise. */
export const PROMISE_METHOD_NAMES = new Set([
  'mutateAsync',
  'invalidateQueries',
  'refetchQueries',
  'resetQueries',
  'fetchQuery',
  'ensureQueryData',
])

/**
 * Named sync boundaries that attach .catch (or require an error handler).
 *
 * A bare name is not enough: any file could declare `const settleBackground = () => {}`
 * and disarm the rule. These names only count when the identifier resolves to
 * {@link BOUNDARY_MODULE_REL} — an import from it, or the module itself.
 */
export const NAMED_PROMISE_BOUNDARIES = new Set(['settleBackground', 'runUserAction'])

/** The one module allowed to define the boundaries (web, mobile and daemon all import it). */
export const BOUNDARY_MODULE_REL = 'packages/shared/src/background.ts'

/**
 * React Query / tRPC mutation and transport option keys — async is normal and
 * awaited by the library. Exclusions apply ONLY to object-literal option
 * contexts, never to JSX attributes (every JSX onX is a UI event edge).
 */
const NON_UI_EVENT_ON_PROPS = new Set([
  // TanStack Query / tRPC mutation options (library awaits these).
  'onSuccess',
  'onError',
  'onSettled',
  'onMutate',
  'onSuccessOnce',
  // Transport / session / stream adapter callbacks (not React event props).
  // Object-literal context only — JSX onError/onStatusChange/… remain event edges.
  'onTransportClosed',
  'onTransportClosedFailure',
  'onStatusChange',
  'onSessionClosed',
  'onSession',
  'onData',
  'onScrollback',
  'onExit',
])

/**
 * JSX event prop naming: onClick, onPress, onMouseEnter, onError, onStatusChange, …
 * Every onX in JSX is an event edge — no library exclusions.
 * @param {string} name
 */
export function isJsxEventPropName(name) {
  return /^on[A-Z]/.test(name)
}

/**
 * Object-literal event prop naming. Library lifecycle keys are excluded only here.
 * @param {string} name
 */
export function isObjectEventPropName(name) {
  return /^on[A-Z]/.test(name) && !NON_UI_EVENT_ON_PROPS.has(name)
}

/** @deprecated Use isJsxEventPropName / isObjectEventPropName. */
export function isEventPropName(name) {
  return isJsxEventPropName(name)
}

/**
 * Scope-aware binding disposition for event-handler identifier resolution.
 * @typedef {'sync' | 'async' | 'import' | 'unresolved-destructured' | 'unknown'} HandlerBindingKind
 */

/**
 * Path aliases the clients actually compile with (vite.config.ts, vitest.config.ts,
 * apps/mobile/tsconfig.json). Longest prefix wins so `@porcelain/client-runtime/`
 * is not eaten by a shorter entry.
 */
export const MODULE_ALIASES = [
  ['@renderer/', 'apps/web/src/'],
  ['@backend/', 'apps/daemon/src/'],
  ['@porcelain/daemon/', 'apps/daemon/src/'],
  ['@main/', 'apps/desktop/src/main/'],
  ['@preload/', 'apps/desktop/src/preload/'],
  ['@shared/', 'packages/shared/src/'],
  ['@porcelain/shared/', 'packages/shared/src/'],
  ['@porcelain/contracts/', 'packages/contracts/src/'],
  ['@porcelain/client-runtime/', 'packages/client-runtime/src/'],
  ['@porcelain/ui/', 'packages/ui/src/'],
  ['@/', 'apps/mobile/src/'],
]

const MODULE_EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.mjs', '.js']

/**
 * Resolve an import specifier to a file inside this repository, or null for
 * node_modules / unresolvable specifiers. Syntax-only: no tsconfig program.
 * @param {string} specifier
 * @param {string} fromFile absolute path of the importing file
 * @param {string} repositoryRoot
 * @returns {string | null} absolute path
 */
export function resolveModuleFile(specifier, fromFile, repositoryRoot) {
  /** @type {string | null} */
  let base = null
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = join(dirname(fromFile), specifier)
  } else {
    let longest = ''
    let target = ''
    for (const [prefix, root] of MODULE_ALIASES) {
      if (specifier.startsWith(prefix) && prefix.length > longest.length) {
        longest = prefix
        target = root
      }
    }
    if (longest === '') return null
    base = join(repositoryRoot, target, specifier.slice(longest.length))
  }
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = `${base}${ext}`
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * @typedef {object} ModuleSignatures
 * @property {Map<string, ts.TypeNode | undefined>} returnTypes exported callable -> declared return type
 * @property {Set<string>} asyncExports exported callables declared `async` or returning Promise
 * @property {Map<string, ts.TypeNode | ts.InterfaceDeclaration>} typeAliases module-local aliases
 */

/** @type {Map<string, ModuleSignatures | null>} */
const moduleSignatureCache = new Map()

/**
 * Declared (never inferred) export signatures for one module. Enough to answer
 * "what does this hook hand back?" without building a TypeScript program.
 * @param {string} absolute
 * @returns {ModuleSignatures | null}
 */
export function moduleSignatures(absolute) {
  const cached = moduleSignatureCache.get(absolute)
  if (cached !== undefined) return cached
  let signatures = null
  try {
    const text = readFileSync(absolute, 'utf8')
    const kind = absolute.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const sourceFile = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true, kind)
    signatures = {
      returnTypes: new Map(),
      asyncExports: new Set(),
      typeAliases: collectLocalTypeAliases(sourceFile),
    }
    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        signatures.returnTypes.set(statement.name.text, statement.type)
        const isAsync =
          statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) === true ||
          isPromiseTypeNode(statement.type)
        if (isAsync) signatures.asyncExports.add(statement.name.text)
      }
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue
          const init = decl.initializer ? unwrapExpression(decl.initializer) : undefined
          if (decl.type) {
            signatures.returnTypes.set(decl.name.text, returnTypeOfFunctionType(decl.type))
            if (functionTypeReturnsPromise(decl.type)) signatures.asyncExports.add(decl.name.text)
            continue
          }
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            signatures.returnTypes.set(decl.name.text, init.type)
            const isAsync =
              init.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) === true ||
              isPromiseTypeNode(init.type)
            if (isAsync) signatures.asyncExports.add(decl.name.text)
          }
        }
      }
    }
  } catch {
    signatures = null
  }
  moduleSignatureCache.set(absolute, signatures)
  return signatures
}

/**
 * @param {ts.Expression} expression
 * @returns {ts.Expression}
 */
function unwrapExpression(expression) {
  let current = expression
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression?.(current)
  ) {
    current = current.expression
  }
  return current
}

/**
 * @param {ts.TypeNode | undefined} typeNode
 */
function isPromiseTypeNode(typeNode) {
  if (!typeNode) return false
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const name = typeNode.typeName.text
    return name === 'Promise' || name === 'PromiseLike'
  }
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some((t) => isPromiseTypeNode(t))
  }
  return false
}

/**
 * True when a function type node returns Promise/PromiseLike.
 * @param {ts.TypeNode | undefined} typeNode
 */
function functionTypeReturnsPromise(typeNode) {
  if (!typeNode) return false
  if (ts.isParenthesizedTypeNode(typeNode)) return functionTypeReturnsPromise(typeNode.type)
  if (ts.isFunctionTypeNode(typeNode) || ts.isConstructorTypeNode(typeNode)) {
    return isPromiseTypeNode(typeNode.type)
  }
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.some((t) => functionTypeReturnsPromise(t))
  }
  // Type literals with call signatures: { (): Promise<void> }
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.some(
      (m) => ts.isCallSignatureDeclaration(m) && isPromiseTypeNode(m.type),
    )
  }
  return false
}

/**
 * Return type of a function-typed annotation, when it has one.
 * @param {ts.TypeNode | undefined} typeNode
 * @returns {ts.TypeNode | undefined}
 */
function returnTypeOfFunctionType(typeNode) {
  if (!typeNode) return undefined
  if (ts.isParenthesizedTypeNode(typeNode)) return returnTypeOfFunctionType(typeNode.type)
  if (ts.isFunctionTypeNode(typeNode)) return typeNode.type
  return undefined
}

/**
 * @param {ts.Expression | undefined} initializer
 * @param {ts.TypeNode | undefined} typeAnnotation
 * @returns {HandlerBindingKind | null} null when not a function-like binding
 */
function classifyFunctionLikeBinding(initializer, typeAnnotation) {
  if (typeAnnotation && functionTypeReturnsPromise(typeAnnotation)) return 'async'
  if (typeAnnotation && isPromiseTypeNode(typeAnnotation)) return 'async'
  if (!initializer) {
    if (typeAnnotation && ts.isFunctionTypeNode(typeAnnotation)) return 'sync'
    return null
  }
  const init = unwrapExpression(initializer)
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
    if (init.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return 'async'
    if (isPromiseTypeNode(init.type)) return 'async'
    return 'sync'
  }
  return null
}

/**
 * Same-file type-alias table built once per scan (no full program / checker).
 * @param {ts.SourceFile} sourceFile
 * @returns {Map<string, ts.TypeNode>}
 */
function collectLocalTypeAliases(sourceFile) {
  /** @type {Map<string, ts.TypeNode>} */
  const aliases = new Map()
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.type) {
      aliases.set(statement.name.text, statement.type)
    }
    if (ts.isInterfaceDeclaration(statement)) {
      // Synthesize a type-literal view of the interface members for property lookup
      aliases.set(statement.name.text, statement)
    }
  }
  return aliases
}

/**
 * Look up a property type from an object type annotation. Resolves same-file type
 * aliases and interfaces; no cross-file checker.
 * @param {ts.TypeNode | ts.InterfaceDeclaration | undefined} typeNode
 * @param {string} propName
 * @param {Map<string, ts.TypeNode | ts.InterfaceDeclaration>} [typeAliases]
 * @returns {ts.TypeNode | undefined}
 */
function findPropertyType(typeNode, propName, typeAliases) {
  if (!typeNode) return undefined
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return findPropertyType(typeNode.type, propName, typeAliases)
  }
  if (ts.isIntersectionTypeNode(typeNode)) {
    for (const part of typeNode.types) {
      const found = findPropertyType(part, propName, typeAliases)
      if (found) return found
    }
    return undefined
  }
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName) && typeAliases) {
    const resolved = typeAliases.get(typeNode.typeName.text)
    if (resolved) return findPropertyType(resolved, propName, typeAliases)
  }
  if (ts.isTypeLiteralNode(typeNode) || ts.isInterfaceDeclaration(typeNode)) {
    for (const member of typeNode.members) {
      if (
        ts.isPropertySignature(member) &&
        member.name &&
        ts.isIdentifier(member.name) &&
        member.name.text === propName
      ) {
        return member.type
      }
    }
  }
  return undefined
}

/**
 * Per-file resolution context: same-file aliases plus where each imported name
 * actually comes from. This is what lets `const discardFile = useDiscardFile()`
 * resolve through the hook's declared return type instead of falling to `unknown`.
 *
 * @typedef {object} FileResolveCtx
 * @property {string} file absolute path of the file being scanned
 * @property {string} repositoryRoot
 * @property {Map<string, ts.TypeNode | ts.InterfaceDeclaration>} typeAliases
 * @property {Map<string, { module: string, exported: string }>} importedFrom
 * @property {Set<string>} boundaryNames names proven to be the real promise boundaries
 * @property {ModuleSignatures | null} own signatures of the file itself
 * @property {Map<string, HandlerBindingKind>[]} [scopeChain] live scope chain while scanning
 */

/**
 * @typedef {object} ResolvedType
 * @property {ts.TypeNode | undefined} type
 * @property {Map<string, ts.TypeNode | ts.InterfaceDeclaration>} aliases alias table of the *defining* module
 */

/**
 * Declared return type of `name(...)`, resolved through imports when needed.
 * @param {string} name
 * @param {FileResolveCtx | undefined} ctx
 * @returns {ResolvedType | null}
 */
function resolveCallReturn(name, ctx) {
  if (!ctx) return null
  const origin = ctx.importedFrom.get(name)
  if (origin) {
    const signatures = moduleSignatures(origin.module)
    if (!signatures?.returnTypes.has(origin.exported)) return null
    return { type: signatures.returnTypes.get(origin.exported), aliases: signatures.typeAliases }
  }
  if (ctx.own?.returnTypes.has(name)) {
    return { type: ctx.own.returnTypes.get(name), aliases: ctx.typeAliases }
  }
  return null
}

/**
 * The declared shape a binding takes from `= someCall()`, when it can be proven.
 * @param {ts.Expression | undefined} initializer
 * @param {FileResolveCtx | undefined} ctx
 * @returns {ResolvedType | null}
 */
function resolveInitializerType(initializer, ctx) {
  if (!initializer) return null
  const init = unwrapExpression(initializer)
  if (!ts.isCallExpression(init)) return null
  const callee = unwrapExpression(init.expression)
  if (!ts.isIdentifier(callee)) return null
  return resolveCallReturn(callee.text, ctx)
}

/**
 * @param {ts.TypeNode | undefined} typeNode
 * @param {number} index
 * @param {Map<string, ts.TypeNode | ts.InterfaceDeclaration>} [aliases]
 * @returns {ts.TypeNode | undefined}
 */
function findTupleElementType(typeNode, index, aliases) {
  if (!typeNode) return undefined
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return findTupleElementType(typeNode.type, index, aliases)
  }
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName) && aliases) {
    const resolved = aliases.get(typeNode.typeName.text)
    if (resolved && !ts.isInterfaceDeclaration(resolved)) {
      return findTupleElementType(resolved, index, aliases)
    }
    return undefined
  }
  if (ts.isTupleTypeNode(typeNode)) {
    const member = typeNode.elements[index]
    if (!member) return undefined
    return ts.isNamedTupleMember(member) ? member.type : member
  }
  // readonly [A, B] / Array<T>
  if (ts.isTypeOperatorNode(typeNode)) return findTupleElementType(typeNode.type, index, aliases)
  if (ts.isArrayTypeNode(typeNode)) return typeNode.elementType
  return undefined
}

/**
 * React hooks whose tuple is a value plus a synchronous setter/dispatcher. Their
 * types live in node_modules, which this scanner deliberately never parses.
 */
const SYNC_TUPLE_HOOKS = new Set([
  'useState',
  'useReducer',
  'useTransition',
  'useOptimistic',
  'useMemoState',
])

/**
 * @param {ts.Expression | undefined} initializer
 */
function isSyncTupleHookCall(initializer) {
  if (!initializer) return false
  const init = unwrapExpression(initializer)
  if (!ts.isCallExpression(init)) return false
  const callee = unwrapExpression(init.expression)
  if (ts.isIdentifier(callee)) return SYNC_TUPLE_HOOKS.has(callee.text)
  if (ts.isPropertyAccessExpression(callee)) return SYNC_TUPLE_HOOKS.has(callee.name.text)
  return false
}

/**
 * @param {ts.TypeNode | undefined} propType
 * @returns {HandlerBindingKind | null}
 */
function classifyResolvedMemberType(propType) {
  if (!propType) return null
  if (functionTypeReturnsPromise(propType)) return 'async'
  if (ts.isFunctionTypeNode(propType)) return 'sync'
  return null
}

/**
 * @param {Map<string, HandlerBindingKind>} scope
 * @param {ts.BindingName} name
 * @param {ts.TypeNode | undefined} typeNode
 * @param {ts.Expression | undefined} initializer
 * @param {FileResolveCtx} [ctx]
 */
function bindPattern(scope, name, typeNode, initializer, ctx) {
  const typeAliases = ctx?.typeAliases
  if (ts.isIdentifier(name)) {
    const kind = classifyFunctionLikeBinding(initializer, typeNode)
    if (kind) {
      scope.set(name.text, kind)
      return
    }
    if (typeNode && functionTypeReturnsPromise(typeNode)) {
      scope.set(name.text, 'async')
      return
    }
    // `const handleCopy: () => void = copyPath` — a rebind inherits what it was given.
    // TypeScript happily assigns `() => Promise<void>` to `() => void`, so the
    // annotation is not evidence; the thing being renamed is.
    const rebound = initializer ? unwrapExpression(initializer) : undefined
    if (rebound && ts.isIdentifier(rebound) && ctx?.scopeChain) {
      const inherited = resolveBinding(ctx.scopeChain, rebound.text)
      if (
        inherited === 'async' ||
        inherited === 'import' ||
        inherited === 'unresolved-destructured'
      ) {
        scope.set(name.text, inherited)
        return
      }
    }
    // `const discardFile = useDiscardFile()` — take the hook's declared return type.
    const resolved = typeNode ? null : resolveInitializerType(initializer, ctx)
    const fromCall = classifyResolvedMemberType(resolved?.type)
    if (fromCall) {
      scope.set(name.text, fromCall)
      return
    }
    // Fresh local binding — shadows outer async names even when not function-like
    // (e.g. const onError = 1) so same-name false positives do not fire.
    scope.set(name.text, 'unknown')
    return
  }

  // `const { stageFile } = useFileStaging()` / `const [save] = useThing()` — the
  // annotation, when present, wins; otherwise resolve the producing call's return type.
  const resolved = typeNode ? null : resolveInitializerType(initializer, ctx)
  const shapeType = typeNode ?? resolved?.type
  const shapeAliases = typeNode ? typeAliases : (resolved?.aliases ?? typeAliases)

  if (ts.isObjectBindingPattern(name)) {
    for (const element of name.elements) {
      if (!ts.isBindingElement(element) || element.dotDotDotToken) continue
      if (
        !ts.isIdentifier(element.name) &&
        !ts.isObjectBindingPattern(element.name) &&
        !ts.isArrayBindingPattern(element.name)
      ) {
        continue
      }
      if (!ts.isIdentifier(element.name)) {
        bindPattern(scope, element.name, undefined, element.initializer, ctx)
        continue
      }
      const propName =
        element.propertyName && ts.isIdentifier(element.propertyName)
          ? element.propertyName.text
          : element.name.text
      const propType = findPropertyType(shapeType, propName, shapeAliases)
      const kind =
        classifyResolvedMemberType(propType) ??
        classifyFunctionLikeBinding(element.initializer, propType)
      // A destructured value can inherit a Promise-returning function type from
      // an imported annotation or an inferred initializer. This syntax-only
      // scanner cannot prove either form synchronous, so event edges must wrap
      // unresolved destructured bindings just like imported handlers.
      scope.set(element.name.text, kind ?? 'unresolved-destructured')
    }
    return
  }
  if (ts.isArrayBindingPattern(name)) {
    // React's own state tuples are a library fact, not an unknown: every slot is a
    // value or a synchronous setter. Without this the rule would demand a wrapper
    // around `onChange={setQuery}` everywhere, which proves nothing.
    if (initializer && isSyncTupleHookCall(initializer)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          scope.set(element.name.text, 'sync')
        }
      }
      return
    }
    // Otherwise symmetric with object destructuring: a tuple slot is exactly as opaque
    // as a property, so `const [save] = useThing()` must not fall through to `unknown`.
    let index = -1
    for (const element of name.elements) {
      index += 1
      if (ts.isOmittedExpression(element)) continue
      if (!ts.isBindingElement(element)) continue
      if (element.dotDotDotToken) {
        bindPattern(scope, element.name, undefined, element.initializer, ctx)
        continue
      }
      if (!ts.isIdentifier(element.name)) {
        bindPattern(scope, element.name, undefined, element.initializer, ctx)
        continue
      }
      const slotType = findTupleElementType(shapeType, index, shapeAliases)
      const kind =
        classifyResolvedMemberType(slotType) ??
        classifyFunctionLikeBinding(element.initializer, slotType)
      scope.set(element.name.text, kind ?? 'unresolved-destructured')
    }
  }
}

/**
 * Register import bindings. A name whose defining module declares it async (or
 * Promise-returning) is proven `async`; everything else stays `import`, which event
 * edges must wrap because this scanner cannot prove it synchronous.
 * @param {Map<string, HandlerBindingKind>} scope
 * @param {ts.SourceFile} sourceFile
 * @param {FileResolveCtx} ctx
 */
function seedImportBindings(scope, sourceFile, ctx) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
    // type-only imports are not runtime handlers
    if (statement.importClause.isTypeOnly) continue
    const specifier = ts.isStringLiteral(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text
      : null
    const module = specifier ? resolveModuleFile(specifier, ctx.file, ctx.repositoryRoot) : null
    const isBoundaryModule =
      module !== null &&
      relative(ctx.repositoryRoot, module).split('\\').join('/') === BOUNDARY_MODULE_REL

    /** @param {string} local @param {string} exported */
    const register = (local, exported) => {
      if (module) ctx.importedFrom.set(local, { module, exported })
      if (isBoundaryModule && NAMED_PROMISE_BOUNDARIES.has(exported)) ctx.boundaryNames.add(local)
      const signatures = module ? moduleSignatures(module) : null
      scope.set(local, signatures?.asyncExports.has(exported) ? 'async' : 'import')
    }

    if (statement.importClause.name) register(statement.importClause.name.text, 'default')
    const bindings = statement.importClause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue
        register(element.name.text, (element.propertyName ?? element.name).text)
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      scope.set(bindings.name.text, 'import')
    }
  }
}

/**
 * @param {Map<string, HandlerBindingKind>} scope
 * @param {ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | ts.ConstructorDeclaration} fn
 * @param {FileResolveCtx} [ctx]
 */
function bindFunctionNameAndParams(scope, fn, ctx) {
  if (
    (ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) &&
    fn.name &&
    ts.isIdentifier(fn.name)
  ) {
    const isAsync =
      fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) || isPromiseTypeNode(fn.type)
    scope.set(fn.name.text, isAsync ? 'async' : 'sync')
  }
  for (const param of fn.parameters ?? []) {
    bindPattern(scope, param.name, param.type, param.initializer, ctx)
  }
}

/**
 * Resolve identifier against a scope chain (innermost first).
 * @param {Map<string, HandlerBindingKind>[]} chain
 * @param {string} name
 * @returns {HandlerBindingKind | undefined}
 */
function resolveBinding(chain, name) {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].has(name)) return chain[i].get(name)
  }
  return undefined
}

/**
 * @param {ts.Expression | undefined} expression
 * @param {Map<string, HandlerBindingKind>[]} scopeChain
 * @param {{ banImports?: boolean }} [opts]
 *   banImports — JSX event edges cannot prove imported handlers are sync, so they
 *   must wrap. Object option bags (streams, session adapters) routinely pass
 *   imported callbacks; only fail those when proven async/Promise-returning.
 */
function isAsyncOrPromiseHandler(expression, scopeChain, opts = {}) {
  if (!expression) return false
  const expr = unwrapExpression(expression)
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    if (expr.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) return true
    if (isPromiseTypeNode(expr.type)) return true
    // The wrapper idiom is only honest when the rule looks inside it. `() => f(x)` and
    // `() => { f(x) }` both hand the framework a Promise it will drop when `f` is
    // Promise-returning, so the body is inspected with the same evidence the scope
    // table already carries.
    return handlerBodyLeaksPromise(expr, scopeChain, opts)
  }
  if (ts.isIdentifier(expr)) {
    const kind = resolveBinding(scopeChain, expr.text)
    // Proven async/Promise bindings always fail. Imports and unresolved
    // destructured bindings fail only when opted in (JSX / addEventListener).
    // Other unknown params / locals pass.
    if (kind === 'async') return true
    if (opts.banImports && (kind === 'import' || kind === 'unresolved-destructured')) return true
    return false
  }
  return false
}

/**
 * True when a call is known to hand back a Promise: a house promise method
 * (`mutateAsync`, `invalidateQueries`, `*Async`) or an identifier the scope table
 * proved async — including hooks resolved through their declaring module.
 * @param {ts.CallExpression} call
 * @param {Map<string, HandlerBindingKind>[]} scopeChain
 * @param {{ ctx?: FileResolveCtx }} [opts]
 */
function isKnownPromiseCall(call, scopeChain, opts = {}) {
  if (isBarePromiseCall(call, opts.ctx)) return true
  const callee = unwrapExpression(call.expression)
  if (ts.isIdentifier(callee)) {
    if (opts.ctx?.boundaryNames.has(callee.text)) return false
    return resolveBinding(scopeChain, callee.text) === 'async'
  }
  return false
}

/**
 * Inspect a synchronous handler's body for a Promise nobody disposed of. Nested
 * functions are skipped — they are their own edges.
 * @param {ts.ArrowFunction | ts.FunctionExpression} fn
 * @param {Map<string, HandlerBindingKind>[]} scopeChain
 * @param {{ ctx?: FileResolveCtx }} [opts]
 */
function handlerBodyLeaksPromise(fn, scopeChain, opts = {}) {
  const bodyScope = new Map()
  bindFunctionNameAndParams(bodyScope, fn, opts.ctx)
  const chain = [...scopeChain, bodyScope]
  let leaks = false

  /** @param {ts.Node} node */
  function walk(node) {
    if (leaks) return
    if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      return
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        bindPattern(bodyScope, decl.name, decl.type, decl.initializer, opts.ctx)
      }
    }
    if (
      ts.isCallExpression(node) &&
      isKnownPromiseCall(node, chain, opts) &&
      // A returned Promise is exactly the bug here: the framework drops it.
      !isPromiseDisposed(node, node.parent, opts.ctx, { returnDisposes: false, stopAt: fn })
    ) {
      leaks = true
      return
    }
    ts.forEachChild(node, walk)
  }

  walk(fn.body)
  return leaks
}

/**
 * Remediation hint for banned event-handler values.
 */
const EVENT_HANDLER_REMEDIATION =
  'use an inline synchronous wrapper that calls a total void action, or runUserAction with a required non-noop error handler'

/**
 * Syntactic no-op: () => undefined, () => {}, () => { return }, () => { return undefined }, …
 * @param {ts.Expression} expression
 */
export function isSyntacticNoOpHandler(expression) {
  const expr = unwrapExpression(expression)
  if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr)) return false
  const body = expr.body
  if (ts.isBlock(body)) {
    const stmts = body.statements.filter((s) => !ts.isEmptyStatement(s))
    if (stmts.length === 0) return true
    if (stmts.length === 1 && ts.isReturnStatement(stmts[0])) {
      const arg = stmts[0].expression
      if (arg === undefined) return true
      const unwrapped = unwrapExpression(arg)
      if (ts.isIdentifier(unwrapped) && unwrapped.text === 'undefined') return true
      if (unwrapped.kind === ts.SyntaxKind.VoidExpression) return true
      return false
    }
    return false
  }
  const unwrapped = unwrapExpression(body)
  if (ts.isIdentifier(unwrapped) && unwrapped.text === 'undefined') return true
  if (unwrapped.kind === ts.SyntaxKind.VoidExpression) return true
  return false
}

/**
 * True when `node` is a CallExpression whose rejection is already disposed
 * (await/return/Promise.all/boundary/complete catch chain).
 * Walks parents from the call.
 * @param {ts.Node} call
 * @param {ts.Node | undefined} parent
 * @param {FileResolveCtx} [ctx]
 * @param {{ returnDisposes?: boolean, stopAt?: ts.Node }} [opts]
 */
function isPromiseDisposed(_call, parent, ctx, opts = {}) {
  const returnDisposes = opts.returnDisposes !== false
  let current = parent
  while (current) {
    if (opts.stopAt && current === opts.stopAt) return false
    if (ts.isAwaitExpression(current)) return true
    if (returnDisposes && ts.isReturnStatement(current)) return true
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current) ||
      ts.isFunctionDeclaration(current)
    ) {
      // returned implicitly from arrow: `() => promise` is still floating when used as expr stmt
      // only treat as disposed if parent of function is return/await — handled by outer walk
      break
    }
    if (ts.isCallExpression(current)) {
      const callee = unwrapExpression(current.expression)
      // Promise.all([...]) / Promise.allSettled
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'Promise' &&
        (callee.name.text === 'all' ||
          callee.name.text === 'allSettled' ||
          callee.name.text === 'race')
      ) {
        return true
      }
      // named boundary(promise) or boundary(() => promise) — only when the name is
      // provably the shared boundary, never a same-named local decoy.
      if (ts.isIdentifier(callee) && ctx?.boundaryNames.has(callee.text)) {
        return true
      }
      // .catch(handler) / .then(..., onReject). A no-op handler is NOT disposition:
      // it is indistinguishable from the bug and carries no reason.
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text
        if (method === 'catch') {
          const handler = current.arguments[0]
          if (handler && !isSyntacticNoOpHandler(handler)) return true
        }
        if (method === 'then' && current.arguments.length >= 2) {
          const onReject = current.arguments[1]
          if (onReject && !isSyntacticNoOpHandler(onReject)) return true
        }
        // continue: foo().then(x) is not disposed
      }
    }
    // void expression — separate rule already bans void; still count as disposed for this scan
    if (current.kind === ts.SyntaxKind.VoidExpression) return true
    current = current.parent
  }
  return false
}

/**
 * Visit the CallExpressions this statement still owns.
 *
 * Two things are deliberately not visited. Nested functions are their own edges. And
 * arguments of a *method* call are a hand-off — `tasks.push(qc.invalidateQueries(…))`
 * gives the promise to the array, which the surrounding `Promise.all` then owns.
 * Arguments of a plain-identifier call ARE visited, so a local indirection like
 * `settleInvalidation(qc.invalidateQueries(…))` cannot hide a float behind a name the
 * rule has never seen.
 *
 * @param {ts.Node} node
 * @param {(call: ts.CallExpression) => void} visit
 */
function forEachOwnCall(node, visit) {
  /** @param {ts.Node} current */
  function walk(current) {
    if (
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current) ||
      ts.isFunctionDeclaration(current)
    ) {
      return
    }
    if (ts.isCallExpression(current)) {
      visit(current)
      const callee = unwrapExpression(current.expression)
      if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
        walk(callee)
        return
      }
    }
    ts.forEachChild(current, walk)
  }
  walk(node)
}

/**
 * @param {ts.CallExpression} call
 * @param {FileResolveCtx} [ctx]
 */
function isBarePromiseCall(call, ctx) {
  const callee = unwrapExpression(call.expression)
  if (ts.isPropertyAccessExpression(callee)) {
    if (PROMISE_METHOD_NAMES.has(callee.name.text)) return true
    // *.mutateAsync already covered; also flag *Async property methods
    if (callee.name.text.endsWith('Async')) return true
    return false
  }
  if (ts.isIdentifier(callee)) {
    if (ctx?.boundaryNames.has(callee.text)) return false
    // *Async callees always return a Promise by house convention.
    if (callee.text.endsWith('Async')) return true
    // Exact bare lifecycle call from the provider incident (not every `connect`/`hydrate` name).
    if (callee.text === 'recoverToPreferredEndpoint') return true
  }
  return false
}

/**
 * @param {string} file
 * @param {string} repositoryRoot
 * @returns {{ file: string, line: number, label: string, snippet: string }[]}
 */
export function scanPromiseDisposition(file, repositoryRoot) {
  const rel = relative(repositoryRoot, file).split('\\').join('/')
  // Tests declare intentional floats for fixtures — skip *.test.*
  if (/\.test\.[tj]sx?$/.test(rel) || /\.spec\.[tj]sx?$/.test(rel)) return []
  if (SKIP_FILES_REL.has(rel)) return []

  const sourceText = readFileSync(file, 'utf8')
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, kind)
  const typeAliases = collectLocalTypeAliases(sourceFile)
  /** @type {FileResolveCtx} */
  const ctx = {
    file,
    repositoryRoot,
    typeAliases,
    importedFrom: new Map(),
    boundaryNames: new Set(),
    own: moduleSignatures(file),
  }
  // The boundary module defines the boundaries; everywhere else must import them.
  if (rel === BOUNDARY_MODULE_REL) {
    for (const name of NAMED_PROMISE_BOUNDARIES) ctx.boundaryNames.add(name)
  }
  /** @type {Map<string, HandlerBindingKind>[]} */
  const scopeChain = [new Map()]
  ctx.scopeChain = scopeChain
  seedImportBindings(scopeChain[0], sourceFile, ctx)
  const hits = []

  /**
   * @param {ts.Node} node
   * @param {string} label
   */
  function pushHit(node, label) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    hits.push({
      file: rel,
      line: line + 1,
      label,
      snippet: sourceText.split('\n')[line]?.trim().slice(0, 120) ?? '',
    })
  }

  /**
   * @param {ts.Node} node
   */
  function visit(node) {
    // Enter function scopes with their own binding map (params + name).
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node)
    ) {
      // Hoist function declaration name into the *current* scope so mutual refs resolve.
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isAsync =
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
          isPromiseTypeNode(node.type)
        scopeChain[scopeChain.length - 1].set(node.name.text, isAsync ? 'async' : 'sync')
      }
      const bodyScope = new Map()
      bindFunctionNameAndParams(bodyScope, node, ctx)
      // Function expression / method name is local to the function when present
      if (
        (ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        const isAsync =
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
          isPromiseTypeNode(node.type)
        bodyScope.set(node.name.text, isAsync ? 'async' : 'sync')
      }
      scopeChain.push(bodyScope)
      // Params already bound; visit children except re-binding params via forEachChild of node
      ts.forEachChild(node, (child) => {
        // Skip parameter nodes (already bound); still visit types? no need
        if (ts.isParameter(child)) return
        visit(child)
      })
      scopeChain.pop()
      return
    }

    // Block scope for const/let shadowing
    if (ts.isBlock(node) || ts.isModuleBlock(node) || ts.isSourceFile(node)) {
      if (!ts.isSourceFile(node)) {
        scopeChain.push(new Map())
      }
      // Hoist function declarations in the block first
      for (const stmt of node.statements) {
        if (ts.isFunctionDeclaration(stmt) && stmt.name) {
          const isAsync =
            stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
            isPromiseTypeNode(stmt.type)
          scopeChain[scopeChain.length - 1].set(stmt.name.text, isAsync ? 'async' : 'sync')
        }
      }
      ts.forEachChild(node, visit)
      if (!ts.isSourceFile(node)) {
        scopeChain.pop()
      }
      return
    }

    // Variable declarations bind into current scope
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        bindPattern(scopeChain[scopeChain.length - 1], decl.name, decl.type, decl.initializer, ctx)
      }
      // Still visit initializers (may contain nested functions / JSX)
      ts.forEachChild(node, visit)
      return
    }

    // Class methods: bind method names on class for referenced handlers
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const classScope = new Map()
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          const isAsync =
            member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
            isPromiseTypeNode(member.type)
          classScope.set(member.name.text, isAsync ? 'async' : 'sync')
        }
      }
      scopeChain.push(classScope)
      ts.forEachChild(node, visit)
      scopeChain.pop()
      return
    }

    // Expression-statement bare promise calls. Every call in the statement counts,
    // not just the outermost one: `decoy(m.mutateAsync(x))` and
    // `m.mutateAsync(x).catch(() => {})` both hide the float one level in.
    if (ts.isExpressionStatement(node)) {
      forEachOwnCall(node.expression, (call) => {
        if (isBarePromiseCall(call, ctx) && !isPromiseDisposed(call, call.parent, ctx)) {
          pushHit(
            call,
            'bare floating Promise call (await/return it, Promise.all, complete .catch, settleBackground, or runUserAction — never leave mutateAsync/invalidateQueries/*Async bare)',
          )
        }
      })
    }

    // JSX event attributes: every onX is an event edge (no library exclusions)
    if (ts.isJsxAttribute(node) && node.name && ts.isIdentifier(node.name)) {
      const attr = node.name.text
      if (isJsxEventPropName(attr) && node.initializer && ts.isJsxExpression(node.initializer)) {
        const init = node.initializer.expression
        if (init && isAsyncOrPromiseHandler(init, scopeChain, { banImports: true, ctx })) {
          pushHit(
            init,
            `async/Promise-returning JSX event callback (framework ignores the returned Promise — ${EVENT_HANDLER_REMEDIATION})`,
          )
        }
      }
    }

    // Object-literal event props — library lifecycle keys excluded only here.
    // Imports are not banned (transport/option bags pass imported callbacks);
    // only proven async/Promise-returning handlers fail.
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      isObjectEventPropName(node.name.text)
    ) {
      const init = unwrapExpression(node.initializer)
      if (isAsyncOrPromiseHandler(init, scopeChain, { banImports: false, ctx })) {
        pushHit(
          init,
          `async/Promise-returning event callback property (framework ignores the returned Promise — ${EVENT_HANDLER_REMEDIATION})`,
        )
      }
    }

    // Imperative addEventListener / removeEventListener second-arg listeners
    if (ts.isCallExpression(node)) {
      const callee = unwrapExpression(node.expression)
      if (
        ts.isPropertyAccessExpression(callee) &&
        (callee.name.text === 'addEventListener' || callee.name.text === 'removeEventListener')
      ) {
        const listener = node.arguments[1]
        if (listener && isAsyncOrPromiseHandler(listener, scopeChain, { banImports: true, ctx })) {
          pushHit(
            listener,
            `async/Promise-returning addEventListener callback (returned Promise is ignored — ${EVENT_HANDLER_REMEDIATION})`,
          )
        }
      }

      // `.catch(() => {})` / `.then(ok, () => {})` — banned outright. A silent settle
      // must come through settleBackground with a reason, or own the error for real.
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text
        const handler =
          method === 'catch'
            ? node.arguments[0]
            : method === 'then' && node.arguments.length >= 2
              ? node.arguments[1]
              : undefined
        if (handler && isSyntacticNoOpHandler(handler)) {
          pushHit(
            handler,
            'no-op catch handler (a silent settle needs a reason — settleBackground(promise, reason) — or a real error owner; () => {} is indistinguishable from the bug)',
          )
        }
      }

      // runUserAction(..., onError) — ban syntactic no-op error handlers
      if (
        ts.isIdentifier(callee) &&
        callee.text === 'runUserAction' &&
        ctx.boundaryNames.has(callee.text) &&
        node.arguments.length >= 2
      ) {
        const onErrorArg = node.arguments[1]
        if (onErrorArg && isSyntacticNoOpHandler(onErrorArg)) {
          pushHit(
            onErrorArg,
            'runUserAction no-op error handler (pass a real toast/Alert/status/log channel — () => undefined and empty blocks are banned)',
          )
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return hits
}

export function scanFile(file, repositoryRoot, mobileSrcRoot) {
  const rel = relative(repositoryRoot, file).split('\\').join('/')
  const isMobile = file.startsWith(`${mobileSrcRoot}/`) || file === mobileSrcRoot
  const terminalRoot = join(mobileSrcRoot, 'features', 'terminal')
  const rules = isMobile
    ? [
        ...FORBIDDEN,
        ...MOBILE_FORBIDDEN,
        ...(file.startsWith(terminalRoot) &&
        !file.endsWith(TERMINAL_PALETTE_FILE) &&
        !/\.test\.tsx?$/.test(file)
          ? TERMINAL_FORBIDDEN
          : []),
      ]
    : FORBIDDEN

  const hits = []
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue
    for (const { re, label } of rules) {
      // Reset lastIndex for global-ish safety; patterns are non-global but keep pure.
      re.lastIndex = 0
      if (re.test(line)) {
        hits.push({ file: rel, line: i + 1, label, snippet: line.trim().slice(0, 120) })
      }
    }
  }

  // File-level: a header AND a second trailing toolbar in the same screen (mobile only).
  if (isMobile && !TOOLBAR_OWNERS.has(rel.slice('apps/mobile/src/'.length))) {
    const code = lines.filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    if (code.some((line) => RENDERS_HEADER.test(line))) {
      const toolbarLine = lines.findIndex((line) => TRAILING_TOOLBAR.test(line))
      if (toolbarLine !== -1) {
        hits.push({
          file: rel,
          line: toolbarLine + 1,
          label:
            'second trailing toolbar on a screen that already renders ScreenHeader/HeaderToolbar (it REPLACES that cluster — the companion bolt and settings disappear; pass a `menu` prop instead)',
          snippet: lines[toolbarLine].trim().slice(0, 120),
        })
      }
    }
  }

  return hits
}

/**
 * @param {string} [repositoryRoot]
 * @returns {{ hits: { file: string, line: number, label: string, snippet: string }[], error?: string }}
 */
export function checkEscapes(repositoryRoot = REPO_ROOT) {
  try {
    const roots = resolveScanRoots(repositoryRoot)
    const allowed = new Set(resolveAllowedFiles(repositoryRoot))
    const vendoredUi = join(repositoryRoot, VENDORED_UI_REL)
    const skipUi = existsSync(vendoredUi) ? vendoredUi : null
    const mobileRootEntry = roots.find((r) => r.relative === 'apps/mobile/src')
    const mobileSrcRoot = mobileRootEntry?.absolute ?? join(repositoryRoot, 'apps/mobile/src')

    const files = []
    for (const root of roots) {
      walk(root.absolute, skipUi, files)
    }

    const hits = []
    for (const file of files) {
      if (allowed.has(file)) continue
      const rel = relative(repositoryRoot, file).split('\\').join('/')
      if (SKIP_FILES_REL.has(rel)) continue
      hits.push(...scanFile(file, repositoryRoot, mobileSrcRoot))
      hits.push(...scanPromiseDisposition(file, repositoryRoot))
    }
    return { hits }
  } catch (error) {
    return {
      hits: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function main() {
  const { hits, error } = checkEscapes(REPO_ROOT)
  if (error) {
    console.error(error)
    process.exit(1)
  }
  if (hits.length > 0) {
    console.error(
      'Escape-hatch drift — `as unknown as`, promise-`void`, bare floating Promise calls, async/Promise event callbacks, addEventListener async listeners, and runUserAction no-op handlers are banned in scanned roots; mobile also enforces @expo/ui / terminal palette / toolbar ownership:\n',
    )
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}  ${h.label}`)
      console.error(`    ${h.snippet}`)
    }
    console.error(
      `\n${hits.length} hit(s). Prefer a structural interface at the seam, a zod parse, or a narrowing type guard; for promises, await/return them or settleBackground(promise) with an explicit catch — bare floating Promises are not safe.`,
    )
    process.exit(1)
  }
  console.log('lint-escapes: ok')
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isMain) main()
