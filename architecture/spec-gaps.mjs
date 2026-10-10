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
  const exports = new Map();
  const sourceNodes = parse(path, source).body;
  const callable = (node) =>
    [
      'FunctionDeclaration',
      'ClassDeclaration',
      'ArrowFunctionExpression',
      'FunctionExpression',
      'ClassExpression',
    ].includes(node?.type);
  const locals = new Map();
  for (const node of sourceNodes) {
    const declaration = node.declaration ?? node;
    if (declaration.id?.name)
      locals.set(declaration.id.name, callable(declaration));
    if (declaration.type === 'VariableDeclaration')
      for (const entry of declaration.declarations)
        if (entry.id.type === 'Identifier')
          locals.set(entry.id.name, callable(entry.init));
  }
  for (const node of sourceNodes) {
    if (node.type === 'ExportDefaultDeclaration')
      exports.set('default', callable(node.declaration));
    if (node.type !== 'ExportNamedDeclaration' || node.exportKind === 'type')
      continue;
    if (node.source) continue;
    const declaration = node.declaration;
    if (
      declaration?.type === 'FunctionDeclaration' ||
      declaration?.type === 'ClassDeclaration'
    )
      exports.set(declaration.id.name, true);
    if (declaration?.type === 'VariableDeclaration')
      for (const entry of declaration.declarations)
        if (entry.id.type === 'Identifier')
          exports.set(entry.id.name, callable(entry.init));
    for (const entry of node.specifiers)
      if (entry.exportKind !== 'type')
        exports.set(
          entry.exported.name ?? entry.exported.value,
          locals.get(entry.local.name) ?? false,
        );
  }
  if (specSource === undefined) return [...exports.keys()];
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
  const valueReference = (node) => {
    if (node.type === 'Identifier') return bindings.get(node.name);
    if (
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      namespaces.has(node.object.name)
    )
      return node.property.name ?? node.property.value;
  };
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
    let owner = callee;
    while (owner.type === 'MemberExpression' && !valueReference(owner))
      owner = owner.object;
    const name = valueReference(owner);
    if (exports.get(name) === false) called.add(name);
    for (const argument of node.arguments)
      walk(argument, (reference) => {
        const name = valueReference(reference);
        if (exports.get(name) === false) called.add(name);
      });
  });
  return [...exports.keys()].filter((name) => !called.has(name));
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
