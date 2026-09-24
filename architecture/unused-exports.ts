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
  isClassDeclaration,
  isEnumDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isInterfaceDeclaration,
  isNamedExports,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
  isTypeAliasDeclaration,
  isVariableStatement,
} from 'typescript/unstable/ast/is';
import { z } from 'zod';

export type UnusedExportFinding = { rule: string; from: string; to: string };

type Binding = { file: string; name: string };
type Imported = { file: string; names: readonly string[] | 'every' };
type ModuleShape = {
  local: Set<string>;
  forwarded: Map<string, Binding>;
  starred: string[];
  imports: Imported[];
};

const checkedFile = /^(?:packages\/[^/]+|apps\/server)\/src\/.+\.ts$/;
const skippedFile = /(?:\.spec|\.d)\.ts$/;
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
  };
  const target = (specifier: Node | undefined) =>
    specifier !== undefined && isStringLiteral(specifier)
      ? resolveModule(root, path, specifier.text, manifests)
      : undefined;
  for (const statement of file.statements) {
    for (const name of declared(statement)) shape.local.add(name);
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
        if (path.startsWith('apps/web/') || shapes.has(path)) continue;
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
    return findings;
  } finally {
    api.close();
  }
}
