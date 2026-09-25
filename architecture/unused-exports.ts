import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { API } from 'typescript/unstable/sync';
import {
  SyntaxKind,
  type ModifierLike,
  type Node,
  type SourceFile,
  type Statement,
} from 'typescript/unstable/ast';
import {
  isCallExpression,
  isClassDeclaration,
  isEnumDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportExpression,
  isInterfaceDeclaration,
  isNamedExports,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
  isTypeAliasDeclaration,
  isVariableStatement,
} from 'typescript/unstable/ast/is';
import { z } from 'zod';
import type { ArchRule } from './policy.ts';

export type UnusedExportFinding = { rule: ArchRule; from: string; to: string };

type Binding = { file: string; name: string };
type Imported = { file: string; names: readonly string[] | 'every' };
type ModuleShape = {
  local: Set<string>;
  forwarded: Map<string, Binding>;
  starred: string[];
  imports: Imported[];
  external: string[];
};

const checkedFile =
  /^(?:(?:packages\/[^/]+|apps\/server)\/src\/.+\.ts|apps\/web\/src\/.+\.tsx?)$/;
const skippedFile = /(?:\.spec|\.d)\.ts$|^apps\/web\/src\/components\/ui\//;
const webSource = 'apps/web/src';
const webCandidates = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const cssImport = /^@import\s+['"]([^'"]+)['"]/gm;
const webManifestSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
});
const workspaceModule = /^@porcelain\/([^/]+)(?:\/(.+))?$/;
const manifestSchema = z.object({
  exports: z.record(z.string(), z.string()).optional(),
});

function exportKeyword(modifier: ModifierLike): boolean {
  return modifier.kind === SyntaxKind.ExportKeyword;
}

function declared(statement: Statement): string[] {
  if (isVariableStatement(statement))
    return statement.modifiers?.some(exportKeyword)
      ? statement.declarationList.declarations.flatMap((declaration) =>
          isIdentifier(declaration.name) ? [declaration.name.text] : [],
        )
      : [];
  if (
    isFunctionDeclaration(statement) ||
    isClassDeclaration(statement) ||
    isInterfaceDeclaration(statement) ||
    isTypeAliasDeclaration(statement) ||
    isEnumDeclaration(statement)
  )
    return statement.modifiers?.some(exportKeyword) && statement.name
      ? [statement.name.text]
      : [];
  return [];
}

function manifestExports(
  root: string,
  name: string,
  cache: Map<string, Record<string, string>>,
): Record<string, string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const path = join(root, 'packages', name, 'package.json');
  const exports = existsSync(path)
    ? (manifestSchema.parse(JSON.parse(readFileSync(path, 'utf8'))).exports ??
      {})
    : {};
  cache.set(name, exports);
  return exports;
}

function resolveModule(
  root: string,
  from: string,
  specifier: string,
  manifests: Map<string, Record<string, string>>,
): string | undefined {
  if (from.startsWith('apps/web/') && /^(?:\.|@\/)/.test(specifier)) {
    const base = specifier.startsWith('@/')
      ? join(root, webSource, specifier.slice('@/'.length))
      : resolve(root, dirname(from), specifier);
    const found = webCandidates
      .map((suffix) => base + suffix)
      .find((path) => /\.tsx?$/.test(path) && existsSync(path));
    return found === undefined ? undefined : relative(root, found);
  }
  if (specifier.startsWith('.'))
    return relative(root, resolve(root, dirname(from), specifier));
  const workspace = workspaceModule.exec(specifier);
  if (!workspace) return undefined;
  const name = workspace[1] ?? '';
  const target = manifestExports(root, name, manifests)[
    workspace[2] === undefined ? '.' : `./${workspace[2]}`
  ];
  return target === undefined
    ? undefined
    : relative(root, join(root, 'packages', name, target));
}

function shapeOf(
  root: string,
  path: string,
  file: SourceFile,
  manifests: Map<string, Record<string, string>>,
): ModuleShape {
  const shape: ModuleShape = {
    local: new Set(),
    forwarded: new Map(),
    starred: [],
    imports: [],
    external: [],
  };
  const target = (specifier: Node | undefined) =>
    specifier !== undefined && isStringLiteral(specifier)
      ? resolveModule(root, path, specifier.text, manifests)
      : undefined;
  const dynamic = (node: Node): undefined => {
    if (isCallExpression(node) && isImportExpression(node.expression)) {
      const source = target(node.arguments[0]);
      if (source !== undefined)
        shape.imports.push({ file: source, names: 'every' });
    }
    node.forEachChild(dynamic);
    return undefined;
  };
  file.forEachChild(dynamic);
  for (const statement of file.statements) {
    for (const name of declared(statement)) shape.local.add(name);
    const specifier =
      isImportDeclaration(statement) || isExportDeclaration(statement)
        ? statement.moduleSpecifier
        : undefined;
    if (
      specifier !== undefined &&
      isStringLiteral(specifier) &&
      !/^(?:\.|@\/)/.test(specifier.text)
    )
      shape.external.push(specifier.text);
    if (isImportDeclaration(statement)) {
      const source = target(statement.moduleSpecifier);
      const bindings = statement.importClause?.namedBindings;
      if (source === undefined) continue;
      if (bindings && isNamespaceImport(bindings))
        shape.imports.push({ file: source, names: 'every' });
      else
        shape.imports.push({
          file: source,
          names: [
            ...(statement.importClause?.name ? ['default'] : []),
            ...(bindings && isNamedImports(bindings)
              ? bindings.elements.map(
                  (element) => (element.propertyName ?? element.name).text,
                )
              : []),
          ],
        });
    }
    if (isExportDeclaration(statement)) {
      const source = target(statement.moduleSpecifier);
      const clause = statement.exportClause;
      if (clause === undefined) {
        if (source !== undefined) shape.starred.push(source);
        continue;
      }
      if (!isNamedExports(clause)) {
        if (source !== undefined)
          shape.imports.push({ file: source, names: 'every' });
        shape.local.add(clause.name.text);
        continue;
      }
      for (const element of clause.elements) {
        const name = element.name.text;
        const original = (element.propertyName ?? element.name).text;
        if (source === undefined) shape.local.add(name);
        else shape.forwarded.set(name, { file: source, name: original });
      }
    }
  }
  return shape;
}

function projectConfigs(root: string): string[] {
  const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, 'packages', entry.name, 'tsconfig.json'));
  return [
    join(root, 'tsconfig.json'),
    join(root, 'apps/server/tsconfig.json'),
    join(root, 'apps/web/tsconfig.json'),
    join(root, 'apps/web/tsconfig.node.json'),
    ...packages,
  ].filter((path) => existsSync(path));
}

export function unusedExportFindings(root: string): UnusedExportFinding[] {
  const api = new API({ cwd: root });
  try {
    const configs = projectConfigs(root);
    const snapshot = api.updateSnapshot({ openProjects: configs });
    const manifests = new Map<string, Record<string, string>>();
    const shapes = new Map<string, ModuleShape>();
    for (const config of configs) {
      const project = snapshot.getProject(config);
      if (!project) throw new Error(`TypeScript did not open ${config}`);
      for (const name of project.program.getSourceFileNames()) {
        if (!name.startsWith(`${root}/`) || name.includes('/node_modules/'))
          continue;
        const path = relative(root, name);
        if (shapes.has(path)) continue;
        const file = project.program.getSourceFile(name);
        if (file) shapes.set(path, shapeOf(root, path, file, manifests));
      }
    }
    const used = new Map<string, Set<string>>();
    const pending: Binding[] = [];
    const every = (file: string) => {
      const shape = shapes.get(file);
      if (!shape) return;
      for (const name of [...shape.local, ...shape.forwarded.keys()])
        pending.push({ file, name });
    };
    for (const shape of shapes.values())
      for (const imported of shape.imports)
        if (imported.names === 'every') every(imported.file);
        else
          for (const name of imported.names)
            pending.push({ file: imported.file, name });
    for (let binding = pending.pop(); binding; binding = pending.pop()) {
      const names = used.get(binding.file) ?? new Set<string>();
      if (names.has(binding.name)) continue;
      names.add(binding.name);
      used.set(binding.file, names);
      const shape = shapes.get(binding.file);
      if (!shape) continue;
      const forwarded = shape.forwarded.get(binding.name);
      if (forwarded) pending.push(forwarded);
      else if (!shape.local.has(binding.name))
        for (const file of shape.starred)
          pending.push({ file, name: binding.name });
    }
    const findings: UnusedExportFinding[] = [];
    for (const [file, shape] of shapes) {
      if (!checkedFile.test(file) || skippedFile.test(file)) continue;
      const names = used.get(file) ?? new Set<string>();
      for (const name of [...shape.local, ...shape.forwarded.keys()])
        if (!names.has(name))
          findings.push({
            rule: 'unused-export',
            from: file,
            to: `${name}: no file imports it; delete it or stop exporting it`,
          });
    }
    return [...findings, ...unusedWebDependencies(root, shapes)];
  } finally {
    api.close();
  }
}

function packageOf(specifier: string): string {
  const [scope = '', name = ''] = specifier.split('/');
  return scope.startsWith('@') ? `${scope}/${name}` : scope;
}

function unusedWebDependencies(
  root: string,
  shapes: ReadonlyMap<string, ModuleShape>,
): UnusedExportFinding[] {
  const manifest = webManifestSchema.parse(
    JSON.parse(readFileSync(join(root, 'apps/web/package.json'), 'utf8')),
  );
  const used = new Set<string>();
  for (const [path, shape] of shapes)
    if (path.startsWith('apps/web/'))
      for (const specifier of shape.external) used.add(packageOf(specifier));
  for (const entry of readdirSync(join(root, webSource)))
    if (entry.endsWith('.css'))
      for (const match of readFileSync(
        join(root, webSource, entry),
        'utf8',
      ).matchAll(cssImport))
        used.add(packageOf(match[1] ?? ''));
  return Object.keys(manifest.dependencies ?? {})
    .filter((name) => !used.has(name))
    .map((name) => ({
      rule: 'unused-dependency',
      from: 'apps/web/package.json',
      to: `${name}: no web file or stylesheet imports it; remove it from the dependencies`,
    }));
}
