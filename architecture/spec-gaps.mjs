import { parseSync } from 'oxc-parser';
import { posix } from 'node:path';

function parse(path, source) {
  const parsed = parseSync(path, source);
  if (parsed.errors.length)
    throw new Error(`Cannot check rule promises in ${path}`);
  return parsed.program;
}

function walk(node, visit, parent, field) {
  if (!node || typeof node !== 'object' || node.type === 'ImportDeclaration')
    return;
  if (node.type?.startsWith('TS')) {
    if (node.expression) walk(node.expression, visit, node, 'expression');
    return;
  }
  visit(node, parent, field);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value))
      value.forEach((child) => walk(child, visit, node, key));
    else if (value && typeof value === 'object') walk(value, visit, node, key);
  }
}

export function unspecifiedExports(
  path,
  source,
  specSource,
  read = () => undefined,
) {
  const exports = new Set();
  for (const node of parse(path, source).body) {
    if (node.type === 'ExportDefaultDeclaration') exports.add('default');
    if (
      node.type !== 'ExportNamedDeclaration' ||
      node.exportKind === 'type' ||
      node.source
    )
      continue;
    const declaration = node.declaration;
    if (['FunctionDeclaration', 'ClassDeclaration'].includes(declaration?.type))
      exports.add(declaration.id.name);
    if (declaration?.type === 'VariableDeclaration')
      for (const entry of declaration.declarations)
        if (entry.id.type === 'Identifier') exports.add(entry.id.name);
    for (const entry of node.specifiers)
      if (entry.exportKind !== 'type')
        exports.add(entry.exported.name ?? entry.exported.value);
  }
  if (specSource === undefined) return [...exports];
  const spec = parse(path.replace(/\.ts$/, '.spec.ts'), specSource);
  const bindings = new Map();
  const namespaces = new Map();
  for (const node of spec.body) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type')
      continue;
    const imported = new Map();
    const module = node.source.value;
    const filename = posix.basename(path);
    if (
      [`./${filename}`, `./${filename.replace(/\.ts$/, '')}`].includes(module)
    )
      for (const name of exports) imported.set(name, name);
    else if (/^@porcelain\/[^/]+\/rules$/.test(module)) {
      const folder = `packages/${module.split('/')[1]}`;
      const manifest = read(`${folder}/package.json`);
      const entry = manifest && JSON.parse(manifest).exports?.['./rules'];
      const barrelPath =
        typeof entry === 'string' ? posix.join(folder, entry) : undefined;
      const barrel = barrelPath && read(barrelPath);
      if (barrel)
        for (const reexport of parse(barrelPath, barrel).body) {
          if (!reexport.source || reexport.exportKind === 'type') continue;
          if (
            posix.join(posix.dirname(barrelPath), reexport.source.value) !==
            path
          )
            continue;
          if (reexport.type === 'ExportAllDeclaration')
            for (const name of exports) imported.set(name, name);
          for (const entry of reexport.specifiers ?? [])
            if (entry.exportKind !== 'type')
              imported.set(
                entry.exported.name ?? entry.exported.value,
                entry.local.name ?? entry.local.value,
              );
        }
    }
    for (const entry of node.specifiers) {
      if (entry.importKind === 'type') continue;
      if (entry.type === 'ImportNamespaceSpecifier')
        namespaces.set(entry.local.name, imported);
      else {
        const name =
          entry.type === 'ImportDefaultSpecifier'
            ? 'default'
            : (entry.imported.name ?? entry.imported.value);
        if (imported.has(name))
          bindings.set(entry.local.name, imported.get(name));
      }
    }
  }
  const referenced = new Set();
  walk(spec, (node, parent, field) => {
    if (node.type === 'Identifier' && bindings.has(node.name)) {
      if (
        (parent?.type === 'MemberExpression' &&
          field === 'property' &&
          !parent.computed) ||
        (parent?.type === 'Property' &&
          field === 'key' &&
          !parent.computed &&
          !parent.shorthand) ||
        field === 'id' ||
        field === 'params'
      )
        return;
      referenced.add(bindings.get(node.name));
    }
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier') {
      const name = node.computed ? node.property.value : node.property.name;
      const exportName = namespaces.get(node.object.name)?.get(name);
      if (exportName) referenced.add(exportName);
    }
  });
  return [...exports].filter((name) => !referenced.has(name));
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
