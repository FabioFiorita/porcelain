import { parseSync } from 'oxc-parser';

const functions = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
];

function names(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'RestElement') return names(pattern.argument);
  if (pattern.type === 'AssignmentPattern') return names(pattern.left);
  if (pattern.type === 'ObjectPattern')
    return pattern.properties.flatMap((entry) =>
      names(entry.value ?? entry.argument),
    );
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(names);
  return [];
}

function hoisted(node) {
  if (!node || typeof node !== 'object' || functions.includes(node.type))
    return [];
  if (node.type === 'VariableDeclaration' && node.kind === 'var')
    return node.declarations.flatMap((entry) => names(entry.id));
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'parent'
      ? []
      : Array.isArray(value)
        ? value.flatMap(hoisted)
        : hoisted(value),
  );
}

function walk(node, visit, shadows = new Set(), parent, field) {
  if (!node || typeof node !== 'object') return;
  const scoped = new Set(shadows);
  if (functions.includes(node.type)) {
    for (const param of node.params)
      for (const name of names(param)) scoped.add(name);
    for (const name of names(node.id)) scoped.add(name);
    for (const name of hoisted(node.body)) scoped.add(name);
  }
  if (
    ['ForStatement', 'ForOfStatement', 'ForInStatement'].includes(node.type)
  ) {
    const declaration = node.init ?? node.left;
    if (declaration?.type === 'VariableDeclaration')
      for (const entry of declaration.declarations)
        for (const name of names(entry.id)) scoped.add(name);
  }
  if (node.type === 'CatchClause')
    for (const name of names(node.param)) scoped.add(name);
  if (node.type === 'BlockStatement')
    for (const statement of node.body) {
      if (statement.type === 'VariableDeclaration')
        for (const declaration of statement.declarations)
          for (const name of names(declaration.id)) scoped.add(name);
      if (['FunctionDeclaration', 'ClassDeclaration'].includes(statement.type))
        for (const name of names(statement.id)) scoped.add(name);
    }
  if (typeof node.type === 'string') visit(node, scoped, parent, field);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value))
      value.forEach((child) => walk(child, visit, scoped, node, key));
    else if (value && typeof value === 'object')
      walk(value, visit, scoped, node, key);
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
  const locals = new Map();
  const callable = (node) =>
    node?.type === 'Identifier'
      ? (locals.get(node.name) ?? false)
      : [
          'FunctionDeclaration',
          'ClassDeclaration',
          'ArrowFunctionExpression',
          'FunctionExpression',
          'ClassExpression',
        ].includes(node?.type);
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
      node.importKind === 'type' ||
      ![`./${filename}`, `./${filename.replace(/\.ts$/, '')}`].includes(
        node.source.value,
      )
    )
      continue;
    for (const entry of node.specifiers) {
      if (entry.importKind === 'type') continue;
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
  const propertyName = (node) =>
    node.computed
      ? node.property.type === 'Literal' &&
        typeof node.property.value === 'string'
        ? node.property.value
        : undefined
      : node.property.name;
  const valueReference = (node, shadows) => {
    if (node.type === 'Identifier' && !shadows.has(node.name))
      return bindings.get(node.name);
    if (
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      namespaces.has(node.object.name) &&
      !shadows.has(node.object.name)
    )
      return propertyName(node);
  };
  walk(spec, (node, shadows) => {
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') return;
    const callee = node.callee;
    if (
      callee.type === 'Identifier' &&
      bindings.has(callee.name) &&
      !shadows.has(callee.name)
    )
      called.add(bindings.get(callee.name));
    if (
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      namespaces.has(callee.object.name) &&
      !shadows.has(callee.object.name)
    )
      called.add(propertyName(callee));
    let owner = callee;
    while (owner.type === 'MemberExpression' && !valueReference(owner, shadows))
      owner = owner.object;
    const name = valueReference(owner, shadows);
    if (exports.get(name) === false) called.add(name);
    for (const argument of node.arguments)
      walk(
        argument,
        (reference, scoped, parent, field) => {
          if (
            parent?.type === 'Property' &&
            field === 'key' &&
            !parent.computed
          )
            return;
          const name = valueReference(reference, scoped);
          if (exports.get(name) === false) called.add(name);
        },
        shadows,
      );
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
