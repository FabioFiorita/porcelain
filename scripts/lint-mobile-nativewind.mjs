import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const mobileSourceRoot = path.resolve('apps/mobile/src')
const styleAttributes = new Set(['style', 'contentContainerStyle'])
const violations = []

/** The two arbitrary font sizes that had grown into a second type scale, and their tokens. */
const tokenisedFontSizes = new Map([
  ['text-[10px]', 'text-3xs'],
  ['text-[11px]', 'text-2xs'],
])

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath)
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      inspectFontSizes(entryPath)
      if (entry.name.endsWith('.tsx')) inspectFile(entryPath)
    }
  }
}

function inspectFontSizes(filePath) {
  const lines = readFileSync(filePath, 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const [literal, token] of tokenisedFontSizes) {
      if (!line.includes(literal)) continue
      const relativePath = path.relative(process.cwd(), filePath)
      violations.push(
        `${relativePath}:${index + 1} ${literal} is a named rung — use ${token} (apps/mobile/src/global.css)`,
      )
    }
  })
}

function inspectFile(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  function visit(node) {
    if (ts.isJsxAttribute(node) && styleAttributes.has(node.name.text)) {
      const expression = node.initializer?.expression
      if (expression && isStaticStyleExpression(expression) && !hasAllowComment(source, node)) {
        report(filePath, sourceFile, node, `${node.name.text} contains only static values`)
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'StyleSheet' &&
      node.expression.name.text === 'create' &&
      !hasAllowComment(source, node)
    ) {
      report(filePath, sourceFile, node, 'StyleSheet.create() is not allowed in mobile UI code')
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function isStaticStyleExpression(expression) {
  const unwrapped = unwrap(expression)
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return unwrapped.properties.every((property) => {
      if (!ts.isPropertyAssignment(property)) return false
      return isStaticStyleExpression(property.initializer)
    })
  }
  if (ts.isArrayLiteralExpression(unwrapped)) {
    return unwrapped.elements.every((element) => isStaticStyleExpression(element))
  }
  if (ts.isPrefixUnaryExpression(unwrapped)) {
    return isStaticStyleExpression(unwrapped.operand)
  }
  return (
    ts.isStringLiteral(unwrapped) ||
    ts.isNumericLiteral(unwrapped) ||
    ts.isNoSubstitutionTemplateLiteral(unwrapped) ||
    unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
    unwrapped.kind === ts.SyntaxKind.FalseKeyword ||
    unwrapped.kind === ts.SyntaxKind.NullKeyword
  )
}

function unwrap(expression) {
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

function hasAllowComment(source, node) {
  const before = source.slice(0, node.getStart())
  const previousLines = before.split('\n').slice(-3).join('\n')
  return previousLines.includes('nativewind-allow-style')
}

function report(filePath, sourceFile, node, message) {
  const relativePath = path.relative(process.cwd(), filePath)
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  violations.push(`${relativePath}:${line + 1}:${character + 1} ${message}`)
}

if (!statSync(mobileSourceRoot).isDirectory()) {
  console.error(`mobile source directory not found: ${mobileSourceRoot}`)
  process.exit(1)
}

walk(mobileSourceRoot)

if (violations.length > 0) {
  console.error(
    'mobile NativeWind guard: use className for static layout styling, and named rungs for type.',
  )
  for (const violation of violations) console.error(`  ${violation}`)
  console.error(
    'If a native/runtime exception is intentional, add a nearby nativewind-allow-style comment with its reason.',
  )
  process.exit(1)
}

console.log('mobile NativeWind guard: ok')
