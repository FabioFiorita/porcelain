import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';
import {
  parseSync as parseBindings,
  traverse,
  type NodePath,
} from '@babel/core';
import { z } from 'zod';
import * as shared from '@porcelain/contracts/shared';
import * as access from '@porcelain/contracts/access';
import * as changes from '@porcelain/contracts/changes';
import * as files from '@porcelain/contracts/files';
import * as gitActions from '@porcelain/contracts/git-actions';
import * as projects from '@porcelain/contracts/projects';
import * as reviews from '@porcelain/contracts/reviews';
import { HttpApi, type HttpApiEndpoint } from 'effect/http-api';

const contractApis = new Map<string, HttpApi.Top>();
for (const [name, value] of Object.entries({
  ...shared,
  ...access,
  ...changes,
  ...files,
  ...gitActions,
  ...projects,
  ...reviews,
}))
  if (HttpApi.isHttpApi(value)) contractApis.set(name, value);
const endpointNames = new Set(
  [...contractApis.values()].flatMap((api) =>
    Object.values(api.groups).flatMap((group) => Object.keys(group.endpoints)),
  ),
);

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
type MemberChain = readonly string[] | undefined;
type Reference = { name: string; member: MemberChain };
type BindingReference = SourceRange & { path: NodePath; name: string };
type Declaration = SourceRange & {
  path: NodePath;
  references: BindingReference[];
};

type Module = {
  file: string;
  apis: Map<string, HttpApi.Top>;
  calls: NodePath[];
  imports: Map<string, { from: string; name: string }>;
  exports: Map<string, { from: string; name: string }>;
  exportAll: string[];
  locals: Map<string, Declaration>;
  importReferences: { name: string; paths: NodePath[] }[];
  startup: SourceRange[];
  startupReferences: Reference[];
};

const transportCallee = /(?:^|[a-z])(?:transport|Transport)$/;
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

function atomEndpoint(callee: NodePath) {
  if (
    !callee.isMemberExpression() ||
    !['query', 'mutation'].includes(propertyName(callee) ?? '')
  )
    return undefined;
  const call = callee.parentPath;
  if (!call?.isCallExpression() || call.get('callee') !== callee)
    return undefined;
  const [group, endpoint] = call.get('arguments');
  return group?.isStringLiteral() && endpoint?.isStringLiteral()
    ? { group: group.node.value, endpoint: endpoint.node.value }
    : undefined;
}

function prependMember(name: string, chains: MemberChain[]): MemberChain[] {
  return chains.map((chain) =>
    chain === undefined ? undefined : [name, ...chain],
  );
}

function destructuredMembers(
  pattern: NodePath,
  seen: Set<NodePath>,
): MemberChain[] {
  if (pattern.isIdentifier()) {
    const binding = pattern.scope.getBinding(pattern.node.name);
    if (!binding?.constant) return [undefined];
    if (binding.referencePaths.length === 0) return [[]];
    return binding.referencePaths.flatMap((reference) =>
      usedMembers(reference, seen, true),
    );
  }
  if (!pattern.isObjectPattern()) return [undefined];
  const chains: MemberChain[] = [];
  for (const property of pattern.get('properties')) {
    const name = propertyName(property);
    if (!property.isObjectProperty() || name === undefined) {
      chains.push(undefined);
      continue;
    }
    const nested = destructuredMembers(property.get('value'), seen);
    chains.push(...prependMember(name, nested));
  }
  return chains.length === 0 ? [undefined] : chains;
}

function usedMembers(
  path: NodePath,
  seen = new Set<NodePath>(),
  afterMember = false,
): MemberChain[] {
  if (seen.has(path)) return [undefined];
  const nextSeen = new Set(seen);
  nextSeen.add(path);
  const parent = path.parentPath;
  if (parent === null) return [undefined];
  if (
    parent.isTSAsExpression() ||
    parent.isTSNonNullExpression() ||
    parent.isTSSatisfiesExpression() ||
    parent.isYieldExpression()
  )
    return usedMembers(parent, nextSeen, afterMember);
  if (parent.isMemberExpression() && parent.get('object') === path) {
    const name = propertyName(parent);
    if (name === undefined) return [undefined];
    const selected = atomEndpoint(parent);
    if (selected) return [[selected.endpoint]];
    const nested = usedMembers(parent, nextSeen, true);
    return prependMember(name, nested);
  }
  if (parent.isCallExpression() && parent.get('callee') === path) {
    if (afterMember) return [[]];
    return usedMembers(parent, nextSeen);
  }
  if (parent.isVariableDeclarator() && parent.get('init') === path) {
    const id = parent.get('id');
    if (id.isObjectPattern()) return destructuredMembers(id, nextSeen);
    if (id.isIdentifier()) {
      const binding = parent.scope.getBinding(id.node.name);
      if (binding?.constant && binding.referencePaths.length > 0)
        return binding.referencePaths.flatMap((reference) =>
          usedMembers(reference, nextSeen, afterMember),
        );
    }
    return [undefined];
  }
  return afterMember ? [[]] : [undefined];
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

function unusedMethodRanges(property: NodePath): SourceRange[] {
  if (propertyName(property) === undefined) return [];
  if (property.isObjectMethod()) return [sourceRange(property)];
  if (!property.isObjectProperty()) return [];
  const value = property.get('value');
  if (value.isFunction()) return [sourceRange(property)];
  if (!value.isObjectExpression()) return [];
  return value.get('properties').flatMap(unusedMethodRanges);
}

function selectedMemberRanges(
  object: NodePath,
  members: readonly string[],
): SourceRange[] | undefined {
  if (!object.isObjectExpression()) return undefined;
  const properties = object.get('properties');
  const name = members[0];
  const selected = properties.filter(
    (property) => propertyName(property) === name,
  );
  if (
    properties.some((property) => propertyName(property) === undefined) ||
    selected.length !== 1
  )
    return undefined;
  const property = selected[0];
  if (property === undefined) return undefined;
  const excluded: SourceRange[] = [];
  if (members.length > 1) {
    if (!property.isObjectProperty()) return undefined;
    const nested = selectedMemberRanges(
      property.get('value'),
      members.slice(1),
    );
    if (nested === undefined) return undefined;
    excluded.push(...nested);
  } else {
    if (
      property.isObjectProperty() &&
      property.get('value').isObjectExpression()
    )
      return undefined;
    let usesThis = false;
    property.traverse({
      ThisExpression() {
        usesThis = true;
      },
    });
    if (usesThis) return undefined;
  }
  for (const sibling of properties)
    if (sibling !== property) excluded.push(...unusedMethodRanges(sibling));
  return excluded;
}

function memberSelection(
  declaration: NodePath,
  member: MemberChain,
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
  const selected = selectedMemberRanges(object, member);
  if (selected !== undefined) excluded.push(...selected);
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
      apis: new Map(),
      calls: [],
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
        if (node.source.value.startsWith('@porcelain/contracts/')) {
          for (const specifier of node.specifiers)
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.type === 'Identifier'
            ) {
              const api = contractApis.get(specifier.imported.name);
              if (api) loaded.apis.set(specifier.local.name, api);
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
        loaded.calls.push(path);
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

  sdkEndpoint(
    file: string,
    callee: NodePath,
    seen = new Set<string>(),
  ): HttpApiEndpoint.Top | undefined {
    const key = `${file}:${callee.node.start}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    if (callee.isIdentifier()) {
      const binding = callee.scope.getBinding(callee.node.name);
      const imported =
        binding?.path.isImportSpecifier() ||
        binding?.path.isImportDefaultSpecifier()
          ? this.module(file).imports.get(callee.node.name)
          : undefined;
      if (imported)
        return this.exportedEndpoint(imported.from, imported.name, seen);
      if (binding?.constant && binding.path.isVariableDeclarator()) {
        const init = binding.path.get('init');
        const id = binding.path.get('id');
        if (
          id.isIdentifier() &&
          (init.isMemberExpression() || init.isIdentifier())
        )
          return this.sdkEndpoint(file, init, seen);
        if (id.isObjectPattern() && init.isExpression()) {
          let method: string | undefined;
          id.traverse({
            ObjectProperty(property) {
              const value = property.get('value');
              if (value.isIdentifier({ name: callee.node.name }))
                method = propertyName(property);
            },
          });
          if (method && endpointNames.has(method))
            return this.endpointFor(
              this.sdkApis(file, init, new Set()),
              method,
            );
        }
      }
      return undefined;
    }
    if (!callee.isMemberExpression()) return undefined;
    const name = propertyName(callee);
    const receiver = callee.get('object');
    const selected = atomEndpoint(callee);
    if (selected)
      return this.endpointFor(
        this.sdkApis(file, receiver, new Set()),
        selected.endpoint,
        selected.group,
      );
    if (name && receiver.isIdentifier()) {
      const binding = receiver.scope.getBinding(receiver.node.name);
      const imported = binding?.path.isImportNamespaceSpecifier()
        ? this.module(file).imports.get(receiver.node.name)
        : undefined;
      if (imported) return this.exportedEndpoint(imported.from, name, seen);
    }
    if (!name || !endpointNames.has(name)) return undefined;
    const object = callee.get('object');
    const apis = this.sdkApis(file, object, new Set());
    return this.endpointFor(apis, name);
  }

  private exportedEndpoint(
    file: string,
    name: string,
    seen: Set<string>,
  ): HttpApiEndpoint.Top | undefined {
    const key = `${file}:endpoint:${name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const module = this.module(file);
    const exported = module.exports.get(name);
    if (exported?.from !== file && exported)
      return this.exportedEndpoint(exported.from, exported.name, seen);
    const declaration = exported && module.locals.get(exported.name);
    if (declaration?.path.isVariableDeclarator()) {
      const init = declaration.path.get('init');
      return init.isExpression()
        ? this.sdkEndpoint(file, init, seen)
        : undefined;
    }
    const matches = module.exportAll
      .map((from) => this.exportedEndpoint(from, name, seen))
      .filter((endpoint) => endpoint !== undefined);
    return new Set(
      matches.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
    ).size === 1
      ? matches[0]
      : undefined;
  }

  private endpointFor(
    apis: readonly HttpApi.Top[],
    name: string,
    groupName?: string,
  ): HttpApiEndpoint.Top | undefined {
    const matches = apis.flatMap((api) =>
      Object.values(api.groups).flatMap((group) => {
        if (groupName !== undefined && group.identifier !== groupName)
          return [];
        const endpoint = group.endpoints[name];
        return endpoint ? [endpoint] : [];
      }),
    );
    const routes = new Set(
      matches.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
    );
    return routes.size === 1 ? matches[0] : undefined;
  }

  isAtomClientCall(file: string, callee: NodePath): boolean {
    return (
      callee.isMemberExpression() &&
      ['query', 'mutation'].includes(propertyName(callee) ?? '') &&
      this.sdkApis(file, callee.get('object'), new Set()).length > 0
    );
  }

  private sdkApis(
    file: string,
    expression: NodePath,
    seen: Set<string>,
  ): HttpApi.Top[] {
    if (expression.isIdentifier()) {
      const name = expression.node.name;
      const key = `${file}:${expression.node.start}:${name}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const module = this.module(file);
      const api = module.apis.get(name);
      if (api) return [api];
      const imported = module.imports.get(name);
      if (imported)
        return this.exportedApis(imported.from, imported.name, seen);
      const binding = expression.scope.getBinding(name);
      if (!binding?.constant) return [];
      if (binding.path.isVariableDeclarator()) {
        const init = binding.path.get('init');
        return init.isExpression() ? this.sdkApis(file, init, seen) : [];
      }
      const apis: HttpApi.Top[] = [];
      binding.path.traverse({
        ReferencedIdentifier: (reference) => {
          if (!reference.findParent((parent) => parent.isTSType()))
            apis.push(...this.sdkApis(file, reference, seen));
        },
      });
      return apis;
    }
    if (expression.isMemberExpression())
      return this.sdkApis(file, expression.get('object'), seen);
    const apis: HttpApi.Top[] = [];
    expression.traverse({
      ReferencedIdentifier: (reference) => {
        if (!reference.findParent((parent) => parent.isTSType()))
          apis.push(...this.sdkApis(file, reference, seen));
      },
    });
    return apis;
  }

  private exportedApis(
    file: string,
    name: string,
    seen: Set<string>,
  ): HttpApi.Top[] {
    const key = `${file}:export:${name}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const module = this.module(file);
    const exported = module.exports.get(name);
    if (!exported)
      return module.exportAll.flatMap((from) =>
        this.exportedApis(from, name, seen),
      );
    if (exported.from !== file)
      return this.exportedApis(exported.from, exported.name, seen);
    const declaration = module.locals.get(exported.name);
    if (!declaration) return [];
    const apis: HttpApi.Top[] = [];
    declaration.path.traverse({
      ReferencedIdentifier: (reference) => {
        if (!reference.findParent((parent) => parent.isTSType()))
          apis.push(...this.sdkApis(file, reference, seen));
      },
    });
    return apis;
  }

  importedDeclarations(folders: readonly string[]) {
    const reached = new Map<string, ReachableRange[]>();
    const problems = new Set<string>();
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
      member?: readonly string[],
    ) => {
      const selectionKey =
        member === undefined ? 'whole' : JSON.stringify(member);
      const key = `${file}:${exported ? 'export' : 'local'}:${name}:${selectionKey}`;
      if (visited.has(key)) return;
      visited.add(key);
      evaluate(file);
      const module = this.module(file);
      if (exported) {
        if (name === '*') {
          const selected = member?.[0];
          if (selected !== undefined && module.exports.has(selected)) {
            visit(file, selected, true, member?.slice(1));
            return;
          }
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
      const value = declaration.path.isVariableDeclarator()
        ? declaration.path.get('init')
        : undefined;
      if (
        /^packages\/client\/src\/(?:features\/[^/]+\/api|shared\/api\/client)\.ts$/.test(
          file,
        ) &&
        declaration.references.some((reference) =>
          module.apis.has(reference.name),
        ) &&
        !(value?.isExpression() && this.sdkEndpoint(file, value)) &&
        (member === undefined ||
          (!endpointNames.has(member.at(-1) ?? '') &&
            member.join('.') !== 'runtime.layer'))
      )
        problems.add(
          `${file}:${lineOf(readFileSync(join(this.root, file), 'utf8'), declaration.start)}: select a literal generated endpoint, because an escaped or dynamic client binding cannot prove feature route coverage.`,
        );
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
    return { reached, problems: [...problems] };
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
  const problems: string[] = [...(imported?.problems ?? [])];
  const files = folders
    .flatMap((folder) => filesUnder(root, folder))
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => /\.tsx?$/.test(path) && !/\.(?:spec|d)\.tsx?$/.test(path))
    .filter(
      (path) =>
        !path.startsWith('packages/client/src/') ||
        imported === undefined ||
        imported.reached.has(path),
    )
    .toSorted();
  for (const file of files) {
    const module = reader.module(file);
    const source = readFileSync(join(root, file), 'utf8');
    for (const path of module.calls) {
      const range = sourceRange(path);
      if (
        file.startsWith('packages/client/src/') &&
        imported !== undefined &&
        !imported.reached
          .get(file)
          ?.some((reached) =>
            reached.includesBody
              ? range.start >= reached.start &&
                range.end <= reached.end &&
                outsideExcluded(range, reached.excluded)
              : range.start === reached.start && range.end === reached.end,
          )
      )
        continue;
      const callee = path.get('callee');
      if (Array.isArray(callee)) continue;
      const endpoint = reader.sdkEndpoint(file, callee);
      if (endpoint)
        calls.push({
          method: endpoint.method,
          path: endpoint.path,
          file,
          line: lineOf(source, range.start),
        });
      else if (
        layer.some((pattern) => pattern.test(file)) &&
        callee.isIdentifier() &&
        (callee.node.name === 'fetch' || transportCallee.test(callee.node.name))
      ) {
        const binding = module.imports.get(callee.node.name);
        if (
          binding?.from === 'packages/client/src/shared/api/transport.ts' &&
          binding.name === 'remoteTransport'
        )
          continue;
        const input = path.get('arguments')[0];
        if (input?.isIdentifier()) continue;
        problems.push(
          `${file}:${lineOf(source, range.start)}: call the generated Effect client so the contract owns the method, path and schemas.`,
        );
      } else if (
        layer.some((pattern) => pattern.test(file)) &&
        callee.isMemberExpression() &&
        (endpointNames.has(propertyName(callee) ?? '') ||
          reader.isAtomClientCall(file, callee))
      )
        problems.push(
          `${file}:${lineOf(source, range.start)}: keep the generated client binding traceable so its feature map can name the route.`,
        );
    }
  }
  return {
    calls,
    problems,
    sharedSources: [...(imported?.reached.keys() ?? [])].filter((file) =>
      file.startsWith('packages/client/src/'),
    ),
  };
}

export function sameRoute(route: string, call: ApiCall): boolean {
  return route === `${call.method} ${call.path}`;
}

export function serverRoutes(_root: string): string[] {
  return [
    ...new Set(
      [...contractApis.values()].flatMap((api) =>
        Object.values(api.groups).flatMap((group) =>
          Object.values(group.endpoints).map(
            (endpoint) => `${endpoint.method} ${endpoint.path}`,
          ),
        ),
      ),
    ),
  ].toSorted();
}
