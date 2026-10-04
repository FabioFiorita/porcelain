import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';
import {
  parseSync as parseBindings,
  traverse,
  type NodePath,
} from '@babel/core';
import { z } from 'zod';
import * as access from '@porcelain/contracts/access';
import * as changes from '@porcelain/contracts/changes';
import * as files from '@porcelain/contracts/files';
import * as gitActions from '@porcelain/contracts/git-actions';
import * as projects from '@porcelain/contracts/projects';
import * as reviews from '@porcelain/contracts/reviews';
import type { Endpoint } from '@porcelain/contracts/shared';

const contractEndpoints = new Map<string, Endpoint>();
for (const [name, value] of Object.entries({
  ...access,
  ...changes,
  ...files,
  ...gitActions,
  ...projects,
  ...reviews,
}))
  if ('method' in value && 'responses' in value)
    contractEndpoints.set(name, value);

export type ApiCall = {
  method: string;
  path: string;
  file: string;
  line: number;
};

type SourceRange = { start: number; end: number };
type ReachableRange = SourceRange & {
  includesBody: boolean;
  excluded: SourceRange[];
};
type Reference = { name: string; member: string | undefined };
type BindingReference = SourceRange & { path: NodePath; name: string };
type Declaration = SourceRange & {
  path: NodePath;
  references: BindingReference[];
};

type Module = {
  file: string;
  endpoints: Map<string, Endpoint>;
  callers: Map<string, string>;
  imports: Map<string, { from: string; name: string }>;
  exports: Map<string, { from: string; name: string }>;
  exportAll: string[];
  locals: Map<string, Declaration>;
  importReferences: { name: string; paths: NodePath[] }[];
  startup: SourceRange[];
  startupReferences: Reference[];
};

const transportCallee = /(?:^|[a-z])(?:transport|Transport)$/;
const serverRouteFolders = [
  'apps/server/src/http/routes',
  'apps/server/src/http/protocol',
];
const clientManifestSchema = z.object({
  exports: z.record(z.string(), z.string()),
});

function filesUnder(root: string, folder: string): string[] {
  const absolute = join(root, folder);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesUnder(root, path) : [path];
  });
}

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

function moduleFile(
  root: string,
  from: string,
  specifier: string,
  exports: Readonly<Record<string, string>>,
) {
  const client = /^@porcelain\/client(?:\/(.+))?$/.exec(specifier);
  const exported =
    client === null
      ? undefined
      : exports[client[1] === undefined ? '.' : `./${client[1]}`];
  const base = exported?.startsWith('./src/')
    ? join(root, 'packages/client', exported)
    : specifier.startsWith('@/')
      ? join(root, 'apps/web/src', specifier.slice(2))
      : specifier.startsWith('.')
        ? resolve(dirname(join(root, from)), specifier)
        : undefined;
  if (base === undefined) return undefined;
  const found = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ].find((candidate) => existsSync(candidate) && candidate.match(/\.tsx?$/));
  return found === undefined ? undefined : relative(root, found);
}

function sourceRange(path: NodePath): SourceRange {
  return { start: path.node.start ?? 0, end: path.node.end ?? 0 };
}

function propertyName(path: NodePath): string | undefined {
  const node = path.node;
  if (
    node.type !== 'MemberExpression' &&
    node.type !== 'ObjectProperty' &&
    node.type !== 'ObjectMethod'
  )
    return undefined;
  const key = node.type === 'MemberExpression' ? node.property : node.key;
  if (!node.computed && key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return undefined;
}

function usedMembers(
  path: NodePath,
  seen = new Set<NodePath>(),
): (string | undefined)[] {
  if (seen.has(path)) return [undefined];
  const nextSeen = new Set(seen);
  nextSeen.add(path);
  const parent = path.parentPath;
  if (parent === null) return [undefined];
  if (
    parent.isTSAsExpression() ||
    parent.isTSNonNullExpression() ||
    parent.isTSSatisfiesExpression()
  )
    return usedMembers(parent, nextSeen);
  if (parent.isMemberExpression() && parent.get('object') === path)
    return [propertyName(parent)];
  if (parent.isCallExpression() && parent.get('callee') === path)
    return usedMembers(parent, nextSeen);
  if (parent.isVariableDeclarator() && parent.get('init') === path) {
    const id = parent.get('id');
    if (id.isObjectPattern()) {
      const members = id.get('properties').map(propertyName);
      return members.length === 0 ? [undefined] : members;
    }
    if (id.isIdentifier()) {
      const binding = parent.scope.getBinding(id.node.name);
      if (binding?.constant && binding.referencePaths.length > 0)
        return binding.referencePaths.flatMap((reference) =>
          usedMembers(reference, nextSeen),
        );
    }
  }
  return [undefined];
}

function returnedObject(declaration: NodePath): NodePath | undefined {
  const value = declaration.isVariableDeclarator()
    ? declaration.get('init')
    : declaration;
  if (value.isObjectExpression()) return value;
  if (!value.isFunction()) return undefined;
  const body = value.get('body');
  if (body.isObjectExpression()) return body;
  const returns: (NodePath | undefined)[] = [];
  body.traverse({
    Function(path) {
      path.skip();
    },
    ReturnStatement(path) {
      const argument = path.get('argument');
      returns.push(argument.isObjectExpression() ? argument : undefined);
    },
  });
  if (returns.length === 1 && returns[0]?.isObjectExpression())
    return returns[0];
  return undefined;
}

function memberSelection(
  declaration: NodePath,
  member: string | undefined,
  module: Module,
) {
  const excluded: SourceRange[] = [];
  let forwarded: NodePath | undefined;
  if (member === undefined) return { excluded, forwarded };
  if (declaration.isVariableDeclarator()) {
    const init = declaration.get('init');
    if (init.isIdentifier()) forwarded = init;
    else if (init.isCallExpression()) {
      const callee = init.get('callee');
      const imported = callee.isIdentifier()
        ? module.imports.get(callee.node.name)
        : undefined;
      const factory = init.get('arguments')[0];
      if (
        imported?.name === 'perConnection' &&
        imported.from.endsWith('/shared/api/per-connection.ts')
      ) {
        if (factory?.isIdentifier()) forwarded = factory;
      } else if (callee.isIdentifier()) forwarded = callee;
    }
  }
  const object = returnedObject(declaration);
  if (object === undefined) return { excluded, forwarded };
  const properties = object.isObjectExpression()
    ? object.get('properties')
    : [];
  if (
    properties.some((property) => propertyName(property) === undefined) ||
    !properties.some((property) => propertyName(property) === member)
  )
    return { excluded, forwarded };
  let usesThis = false;
  for (const property of properties)
    if (propertyName(property) === member)
      property.traverse({
        ThisExpression() {
          usesThis = true;
        },
      });
  if (usesThis) return { excluded, forwarded };
  for (const property of properties) {
    const callable =
      property.isObjectMethod() ||
      (property.isObjectProperty() && property.get('value').isFunction());
    if (callable && propertyName(property) !== member)
      excluded.push(sourceRange(property));
  }
  return { excluded, forwarded };
}

function outsideExcluded(
  range: SourceRange,
  excluded: readonly SourceRange[],
): boolean {
  return !excluded.some(
    (skip) => range.start >= skip.start && range.end <= skip.end,
  );
}

class RouteReader {
  private readonly root: string;
  private readonly modules = new Map<string, Module>();
  private readonly clientExports: Readonly<Record<string, string>>;

  constructor(root: string) {
    this.root = root;
    const manifest = join(root, 'packages/client/package.json');
    this.clientExports = existsSync(manifest)
      ? clientManifestSchema.parse(JSON.parse(readFileSync(manifest, 'utf8')))
          .exports
      : {};
  }

  module(file: string): Module {
    const known = this.modules.get(file);
    if (known) return known;
    const loaded: Module = {
      file,
      endpoints: new Map(),
      callers: new Map(),
      imports: new Map(),
      exports: new Map(),
      exportAll: [],
      locals: new Map(),
      startup: [],
      startupReferences: [],
      importReferences: [],
    };
    this.modules.set(file, loaded);
    const source = readFileSync(join(this.root, file), 'utf8');
    new Visitor({
      ImportDeclaration: (node) => {
        if (node.importKind === 'type') return;
        for (const specifier of node.specifiers)
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type' &&
            specifier.imported.type === 'Identifier' &&
            ['requestEndpoint', 'endpointPath'].includes(
              specifier.imported.name,
            )
          )
            loaded.callers.set(specifier.local.name, specifier.imported.name);
        if (node.source.value.startsWith('@porcelain/contracts/')) {
          for (const specifier of node.specifiers)
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.type === 'Identifier'
            ) {
              const endpoint = contractEndpoints.get(specifier.imported.name);
              if (endpoint)
                loaded.endpoints.set(specifier.local.name, endpoint);
            }
          return;
        }
        const from = moduleFile(
          this.root,
          file,
          node.source.value,
          this.clientExports,
        );
        if (from === undefined) return;
        if (node.specifiers.length === 0)
          loaded.imports.set(node.source.value, {
            from,
            name: '*side-effect*',
          });
        for (const specifier of node.specifiers)
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type'
          )
            loaded.imports.set(specifier.local.name, {
              from,
              name:
                specifier.imported.type === 'Identifier'
                  ? specifier.imported.name
                  : specifier.imported.value,
            });
          else if (specifier.type === 'ImportDefaultSpecifier')
            loaded.imports.set(specifier.local.name, { from, name: 'default' });
          else if (specifier.type === 'ImportNamespaceSpecifier')
            loaded.imports.set(specifier.local.name, { from, name: '*' });
      },
      ExportNamedDeclaration: (node) => {
        if (node.exportKind === 'type') return;
        const from =
          node.source === null
            ? file
            : moduleFile(
                this.root,
                file,
                node.source.value,
                this.clientExports,
              );
        if (from === undefined) return;
        for (const specifier of node.specifiers) {
          if (specifier.exportKind === 'type') continue;
          loaded.exports.set(
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : specifier.exported.value,
            {
              from,
              name:
                specifier.local.type === 'Identifier'
                  ? specifier.local.name
                  : specifier.local.value,
            },
          );
        }
        const declaration = node.declaration;
        if (
          declaration?.type === 'FunctionDeclaration' ||
          declaration?.type === 'ClassDeclaration'
        ) {
          if (declaration.id !== null)
            loaded.exports.set(declaration.id.name, {
              from: file,
              name: declaration.id.name,
            });
        } else if (declaration?.type === 'VariableDeclaration')
          for (const declared of declaration.declarations)
            if (declared.id.type === 'Identifier')
              loaded.exports.set(declared.id.name, {
                from: file,
                name: declared.id.name,
              });
      },
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;
        if (declaration.type === 'TSInterfaceDeclaration') return;
        if (declaration.type === 'Identifier')
          loaded.exports.set('default', { from: file, name: declaration.name });
        else if (
          (declaration.type === 'FunctionDeclaration' ||
            declaration.type === 'ClassDeclaration') &&
          declaration.id !== null
        )
          loaded.exports.set('default', {
            from: file,
            name: declaration.id.name,
          });
        else {
          loaded.exports.set('default', { from: file, name: 'default' });
        }
      },
      ExportAllDeclaration: (node) => {
        if (node.exportKind === 'type') return;
        const from = moduleFile(
          this.root,
          file,
          node.source.value,
          this.clientExports,
        );
        if (from === undefined) return;
        if (node.exported === null) loaded.exportAll.push(from);
        else
          loaded.exports.set(
            node.exported.type === 'Identifier'
              ? node.exported.name
              : node.exported.value,
            { from, name: '*' },
          );
      },
    }).visit(parseSync(file, source).program);
    const bindings = parseBindings(source, {
      filename: file,
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
    });
    if (bindings === null)
      throw new Error(
        `${file}: parse its bindings so features:check can follow imported names.`,
      );
    traverse(bindings, {
      Program(path) {
        const record = (name: string, declaration: NodePath) => {
          const references: BindingReference[] = [];
          declaration.traverse({
            ReferencedIdentifier(reference) {
              if (reference.findParent((parent) => parent.isTSType())) return;
              const binding = reference.scope.getBinding(reference.node.name);
              if (binding?.scope === path.scope)
                references.push({
                  ...sourceRange(reference),
                  path: reference,
                  name: reference.node.name,
                });
            },
          });
          loaded.locals.set(name, {
            ...sourceRange(declaration),
            path: declaration,
            references,
          });
        };
        for (const [name, binding] of Object.entries(path.scope.bindings)) {
          if (!loaded.imports.has(name)) record(name, binding.path);
          else {
            loaded.importReferences.push({
              name,
              paths: binding.referencePaths,
            });
          }
        }
        for (const statement of path.get('body'))
          if (statement.isExportDefaultDeclaration()) {
            const declaration = statement.get('declaration');
            if (!declaration.isIdentifier()) record('default', declaration);
          }
      },
      CallExpression(path) {
        if (path.getFunctionParent() !== null) return;
        loaded.startup.push({
          start: path.node.start ?? 0,
          end: path.node.end ?? source.length,
        });
        const callee = path.get('callee');
        if (
          callee.isIdentifier() &&
          callee.scope.getBinding(callee.node.name)?.scope.path.isProgram()
        )
          for (const member of usedMembers(callee))
            loaded.startupReferences.push({ name: callee.node.name, member });
      },
    });
    return loaded;
  }

  importedDeclarations(folders: readonly string[]) {
    const reached = new Map<string, ReachableRange[]>();
    const visited = new Set<string>();
    const evaluated = new Set<string>();
    const include = (
      file: string,
      range: SourceRange,
      includesBody: boolean,
      excluded: SourceRange[] = [],
    ) => {
      const ranges = reached.get(file) ?? [];
      ranges.push({ ...range, includesBody, excluded });
      reached.set(file, ranges);
    };
    const evaluate = (file: string) => {
      if (evaluated.has(file)) return;
      evaluated.add(file);
      const module = this.module(file);
      for (const range of module.startup) include(file, range, false);
      for (const reference of module.startupReferences)
        visit(file, reference.name, false, reference.member);
      for (const binding of [
        ...module.imports.values(),
        ...module.exports.values(),
      ])
        if (binding.from !== file) evaluate(binding.from);
      for (const from of module.exportAll) evaluate(from);
    };
    const visit = (
      file: string,
      name: string,
      exported: boolean,
      member?: string,
    ) => {
      const selectionKey = member === undefined ? 'whole' : `member:${member}`;
      const key = `${file}:${exported ? 'export' : 'local'}:${name}:${selectionKey}`;
      if (visited.has(key)) return;
      visited.add(key);
      evaluate(file);
      const module = this.module(file);
      if (exported) {
        if (name === '*') {
          for (const name of module.exports.keys()) visit(file, name, true);
          for (const from of module.exportAll) visit(from, '*', true);
          return;
        }
        const binding = module.exports.get(name);
        if (binding !== undefined)
          visit(binding.from, binding.name, binding.from !== file, member);
        else
          for (const from of module.exportAll) visit(from, name, true, member);
        return;
      }
      const imported = module.imports.get(name);
      if (imported !== undefined) {
        visit(imported.from, imported.name, true, member);
        return;
      }
      const declaration = module.locals.get(name);
      if (declaration === undefined) return;
      const selection = memberSelection(declaration.path, member, module);
      include(file, declaration, true, selection.excluded);
      for (const reference of declaration.references) {
        if (!outsideExcluded(reference, selection.excluded)) continue;
        const members =
          reference.path === selection.forwarded
            ? [member]
            : usedMembers(reference.path);
        for (const selected of members)
          visit(file, reference.name, false, selected);
      }
    };
    for (const folder of folders)
      for (const file of filesUnder(this.root, folder))
        if (/\.tsx?$/.test(file) && !/\.(?:spec|d)\.tsx?$/.test(file)) {
          evaluate(file);
          const module = this.module(file);
          for (const reference of module.importReferences) {
            const binding = module.imports.get(reference.name);
            if (binding === undefined || binding.name === '*side-effect*')
              continue;
            const members =
              reference.paths.length === 0
                ? [undefined]
                : reference.paths.flatMap((path) => usedMembers(path));
            for (const member of members)
              visit(binding.from, binding.name, true, member);
          }
        }
    return reached;
  }
}

export function apiCalls(
  root: string,
  folders: readonly string[],
  layer: readonly RegExp[],
  importedFrom?: readonly string[],
): {
  calls: ApiCall[];
  problems: string[];
  sharedSources: string[];
} {
  const reader = new RouteReader(root);
  const imported =
    importedFrom === undefined
      ? undefined
      : reader.importedDeclarations(importedFrom);
  const calls: ApiCall[] = [];
  const problems: string[] = [];
  const files = folders
    .flatMap((folder) => filesUnder(root, folder))
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => layer.some((pattern) => pattern.test(path)))
    .filter(
      (path) =>
        !path.startsWith('packages/client/src/') ||
        imported === undefined ||
        imported.has(path),
    )
    .toSorted();
  for (const file of files) {
    const module = reader.module(file);
    const source = readFileSync(join(root, file), 'utf8');
    new Visitor({
      CallExpression(node) {
        if (
          file.startsWith('packages/client/src/') &&
          imported !== undefined &&
          !imported
            .get(file)
            ?.some((range) =>
              range.includesBody
                ? node.start >= range.start &&
                  node.end <= range.end &&
                  outsideExcluded(node, range.excluded)
                : node.start === range.start && node.end === range.end,
            )
        )
          return;
        if (node.callee.type !== 'Identifier') return;
        const operation = module.callers.get(node.callee.name);
        if (operation === 'requestEndpoint' || operation === 'endpointPath') {
          const reference =
            node.arguments[operation === 'requestEndpoint' ? 1 : 0];
          const endpoint =
            reference?.type === 'Identifier'
              ? module.endpoints.get(reference.name)
              : undefined;
          const line = lineOf(source, node.start);
          if (endpoint === undefined) {
            problems.push(
              `${file}:${line}: call an endpoint imported from its contract so features:check can name its route.`,
            );
            return;
          }
          calls.push({
            method: endpoint.method,
            path: `${endpoint.prefix}${endpoint.path}`,
            file,
            line,
          });
        } else if (
          node.callee.name === 'fetch' ||
          transportCallee.test(node.callee.name)
        ) {
          const input = node.arguments[0];
          if (input?.type === 'Identifier') return;
          problems.push(
            `${file}:${lineOf(source, node.start)}: call through requestEndpoint; the contract owns HTTP paths, methods and schemas.`,
          );
        }
      },
    }).visit(parseSync(file, source).program);
  }
  return {
    calls,
    problems,
    sharedSources: [...(imported?.keys() ?? [])].filter((file) =>
      file.startsWith('packages/client/src/'),
    ),
  };
}

export function sameRoute(route: string, call: ApiCall): boolean {
  return route === `${call.method} ${call.path}`;
}

export function serverRoutes(root: string): string[] {
  const reader = new RouteReader(root);
  const routes = new Set<string>();
  for (const file of serverRouteFolders.flatMap((folder) =>
    filesUnder(root, folder),
  )) {
    const module = reader.module(file);
    const source = readFileSync(join(root, file), 'utf8');
    new Visitor({
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'route'
        )
          return;
        const options = node.arguments[0];
        if (options?.type !== 'ObjectExpression') return;
        const method = options.properties.find(
          (property) =>
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'method',
        );
        if (
          method?.type !== 'Property' ||
          method.value.type !== 'MemberExpression' ||
          method.value.object.type !== 'Identifier'
        )
          return;
        const endpoint = module.endpoints.get(method.value.object.name);
        if (endpoint)
          routes.add(`${endpoint.method} ${endpoint.prefix}${endpoint.path}`);
      },
    }).visit(parseSync(file, source).program);
  }
  return [...routes].toSorted();
}
