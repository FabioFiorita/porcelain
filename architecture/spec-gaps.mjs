import { parseSync } from 'oxc-parser';

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

function parse(path, source) {
  const parsed = parseSync(path, source);
  if (parsed.errors.length)
    throw new Error(`Cannot check rule promises in ${path}`);
  return parsed.program;
}

export function unspecifiedExports(path, source, specSource) {
  const exports = [];
  for (const node of parse(path, source).body) {
    if (node.type === 'ExportDefaultDeclaration') exports.push('default');
    if (node.type !== 'ExportNamedDeclaration' || node.exportKind === 'type')
      continue;
    if (node.source) continue;
    const declaration = node.declaration;
    if (
      declaration?.type === 'FunctionDeclaration' ||
      declaration?.type === 'ClassDeclaration'
    )
      exports.push(declaration.id.name);
    if (declaration?.type === 'VariableDeclaration')
      for (const entry of declaration.declarations)
        if (entry.id.type === 'Identifier') exports.push(entry.id.name);
    for (const entry of node.specifiers)
      if (entry.exportKind !== 'type')
        exports.push(entry.exported.name ?? entry.exported.value);
  }
  if (specSource === undefined) return exports;
  const spec = parse(path.replace(/\.ts$/, '.spec.ts'), specSource);
  const bindings = new Map();
  const namespaces = new Set();
  const filename = path.slice(path.lastIndexOf('/') + 1);
  for (const node of spec.body) {
    if (
      node.type !== 'ImportDeclaration' ||
      ![`./${filename}`, `./${filename.replace(/\.ts$/, '')}`].includes(
        node.source.value,
      )
    )
      continue;
    for (const entry of node.specifiers) {
      if (entry.type === 'ImportNamespaceSpecifier')
        namespaces.add(entry.local.name);
      else if (entry.type === 'ImportDefaultSpecifier')
        bindings.set(entry.local.name, 'default');
      else if (entry.importKind !== 'type')
        bindings.set(
          entry.local.name,
          entry.imported.name ?? entry.imported.value,
        );
    }
  }
  const called = new Set();
  walk(spec, (node) => {
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return;
    const callee = node.callee;
    if (callee.type === 'Identifier' && bindings.has(callee.name))
      called.add(bindings.get(callee.name));
    if (
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      namespaces.has(callee.object.name)
    )
      called.add(callee.property.name ?? callee.property.value);
  });
  return exports.filter((name) => !called.has(name));
}

export function specGapProblems(current, baseline, allowed) {
  return [
    ...current
      .filter((gap) => !baseline.includes(gap))
      .map((gap) => `Unspecified rule export: ${gap}`),
    ...baseline
      .filter((gap) => !current.includes(gap))
      .map((gap) => `Remove resolved baseline entry: ${gap}`),
    ...baseline
      .filter((gap) => !allowed.includes(gap))
      .map((gap) => `The spec-gap baseline may only shrink: ${gap}`),
  ];
}
