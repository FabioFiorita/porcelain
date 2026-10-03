import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseSync, Visitor } from 'oxc-parser';
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

type Module = {
  file: string;
  endpoints: Map<string, Endpoint>;
  callers: Map<string, string>;
  imports: Map<string, { from: string; name: string }>;
  exports: Map<string, { from: string; name: string }>;
  exportAll: string[];
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
    return loaded;
  }

  importedFiles(folders: readonly string[]): ReadonlySet<string> {
    const imported = new Set<string>();
    const visit = (file: string) => {
      if (imported.has(file)) return;
      imported.add(file);
      const module = this.module(file);
      for (const binding of [
        ...module.imports.values(),
        ...module.exports.values(),
      ])
        if (binding.from !== file) visit(binding.from);
      for (const from of module.exportAll) visit(from);
    };
    for (const folder of folders)
      for (const file of filesUnder(this.root, folder))
        if (/\.tsx?$/.test(file) && !/\.(?:spec|d)\.ts$/.test(file))
          visit(file);
    return imported;
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
    importedFrom === undefined ? undefined : reader.importedFiles(importedFrom);
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
    sharedSources: [...(imported ?? [])].filter((file) =>
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
