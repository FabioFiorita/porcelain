import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  parseSync,
  Visitor,
  type Argument,
  type ArrowFunctionExpression,
  type Expression,
  type Function as FunctionNode,
} from 'oxc-parser';
import { z } from 'zod';

export type ApiCall = {
  method: string;
  path: string;
  file: string;
  line: number;
};

type Callable = FunctionNode | ArrowFunctionExpression;
type Module = {
  file: string;
  values: Map<string, Expression[]>;
  functions: Map<string, Callable[]>;
  imports: Map<string, { from: string; name: string }>;
  exports: Map<string, { from: string; name: string }>;
  exportAll: string[];
};

const unknown = '\u0001';
const alternativesLimit = 32;
const transportCallee = /(?:^|[a-z])(?:transport|Transport)$/;
const serverRouteFolders = [
  'apps/server/src/http/routes',
  'apps/server/src/http/protocol',
];
const serverRoute =
  /\b(?:api|server)\.(get|post|put|patch|delete)\(\s*'(\/[^']*)'/g;
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

function push<T>(map: Map<string, T[]>, name: string, value: T) {
  map.set(name, [...(map.get(name) ?? []), value]);
}

function combine(parts: readonly string[][]): string[] {
  return parts
    .reduce<string[]>(
      (joined, options) =>
        joined
          .flatMap((prefix) => options.map((option) => prefix + option))
          .slice(0, alternativesLimit),
      [''],
    )
    .filter((value, index, all) => all.indexOf(value) === index);
}

class RouteReader {
  private readonly root: string;
  private readonly modules = new Map<string, Module>();
  private readonly resolving = new Set<Callable>();
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
      values: new Map(),
      functions: new Map(),
      imports: new Map(),
      exports: new Map(),
      exportAll: [],
    };
    this.modules.set(file, loaded);
    const source = readFileSync(join(this.root, file), 'utf8');
    new Visitor({
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || node.init === null) return;
        if (
          node.init.type === 'ArrowFunctionExpression' ||
          node.init.type === 'FunctionExpression'
        )
          push(loaded.functions, node.id.name, node.init);
        else push(loaded.values, node.id.name, node.init);
      },
      FunctionDeclaration(node) {
        if (node.id) push(loaded.functions, node.id.name, node);
      },
      ImportDeclaration: (node) => {
        if (node.importKind === 'type') return;
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
          if (
            declaration.type === 'FunctionDeclaration' ||
            declaration.type === 'FunctionExpression' ||
            declaration.type === 'ArrowFunctionExpression'
          )
            push(loaded.functions, 'default', declaration);
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

  private functionsNamed(
    module: Module,
    name: string,
    seen = new Set<string>(),
  ): [Module, Callable][] {
    const key = `${module.file}:${name}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const local = module.functions.get(name) ?? [];
    if (local.length > 0) return local.map((callable) => [module, callable]);
    const imported = module.imports.get(name) ?? module.exports.get(name);
    if (imported !== undefined)
      return this.functionsNamed(
        this.module(imported.from),
        imported.name,
        seen,
      );
    return module.exportAll.flatMap((file) =>
      this.functionsNamed(this.module(file), name, seen),
    );
  }

  private returned(module: Module, callable: Callable): string[] {
    if (this.resolving.has(callable) || callable.body === null)
      return [unknown];
    this.resolving.add(callable);
    try {
      if (callable.body.type !== 'BlockStatement')
        return this.value(module, callable.body);
      const found = callable.body.body.findLast(
        (statement) => statement.type === 'ReturnStatement',
      );
      return found?.type === 'ReturnStatement' && found.argument !== null
        ? this.value(module, found.argument)
        : [unknown];
    } finally {
      this.resolving.delete(callable);
    }
  }

  value(module: Module, node: Expression | Argument): string[] {
    if (node.type === 'Literal')
      return typeof node.value === 'string' ? [node.value] : [unknown];
    if (node.type === 'TemplateLiteral')
      return combine(
        node.quasis.flatMap((quasi, index) => {
          const expression = node.expressions[index];
          const text = [quasi.value.cooked ?? quasi.value.raw];
          return expression === undefined
            ? [text]
            : [text, this.value(module, expression)];
        }),
      );
    if (node.type === 'ConditionalExpression')
      return [
        ...this.value(module, node.consequent),
        ...this.value(module, node.alternate),
      ];
    if (node.type === 'ParenthesizedExpression')
      return this.value(module, node.expression);
    if (node.type === 'Identifier') {
      const values = module.values.get(node.name) ?? [];
      return values.length === 0
        ? [unknown]
        : values.flatMap((value) => this.value(module, value));
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const callables = this.functionsNamed(module, node.callee.name);
      return callables.length === 0
        ? [unknown]
        : callables.flatMap(([owner, callable]) =>
            this.returned(owner, callable),
          );
    }
    return [unknown];
  }
}

function methodOf(init: Argument | undefined): string | undefined {
  if (init?.type !== 'ObjectExpression') return 'GET';
  for (const property of init.properties)
    if (
      property.type === 'Property' &&
      !property.computed &&
      property.key.type === 'Identifier' &&
      property.key.name === 'method'
    )
      return property.value.type === 'Literal' &&
        typeof property.value.value === 'string'
        ? property.value.value
        : undefined;
  return 'GET';
}

function routePath(value: string): string | undefined {
  const start = value.indexOf('/api/');
  if (start === -1) return undefined;
  const path = value.slice(start).split('?')[0] ?? '';
  return path
    .split('/')
    .map((segment) =>
      segment !== '' && segment.replaceAll(unknown, '') === ''
        ? ':param'
        : segment,
    )
    .join('/');
}

export function apiCalls(
  root: string,
  folders: readonly string[],
  layer: readonly RegExp[],
): {
  calls: ApiCall[];
  problems: string[];
} {
  const reader = new RouteReader(root);
  const calls: ApiCall[] = [];
  const problems: string[] = [];
  const files = folders
    .flatMap((folder) => filesUnder(root, folder))
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => layer.some((pattern) => pattern.test(path)))
    .toSorted();
  for (const file of files) {
    const module = reader.module(file);
    const source = readFileSync(join(root, file), 'utf8');
    const site = (
      offset: number,
      path: Argument | undefined,
      init: Argument | undefined,
    ) => {
      if (path?.type === 'Identifier' && !module.values.has(path.name)) return;
      const line = lineOf(source, offset);
      const method = methodOf(init);
      const paths =
        path === undefined
          ? []
          : reader
              .value(module, path)
              .map(routePath)
              .filter((value) => value !== undefined);
      if (method === undefined || paths.length === 0) {
        problems.push(
          `${file}:${line}: the feature-map check cannot read the route this call reaches; build the path from literals, encodeURIComponent and path helpers, and name the method as a literal.`,
        );
        return;
      }
      for (const found of new Set(paths))
        calls.push({ method, path: found, file, line });
    };
    new Visitor({
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name === 'requestJson')
          site(node.start, node.arguments[1], node.arguments[3]);
        else if (
          node.callee.name === 'fetch' ||
          transportCallee.test(node.callee.name)
        )
          site(node.start, node.arguments[0], node.arguments[1]);
      },
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'WebSocket'
        )
          site(node.start, node.arguments[0], undefined);
      },
    }).visit(parseSync(file, source).program);
  }
  return { calls, problems };
}

function segmentsMatch(route: string[], call: string[]): boolean {
  return (
    route.length === call.length &&
    route.every(
      (segment, index) =>
        segment === call[index] ||
        (segment.startsWith(':') && call[index] === ':param'),
    )
  );
}

export function sameRoute(route: string, call: ApiCall): boolean {
  const [method = '', path = ''] = route.split(' ');
  return (
    method === call.method &&
    segmentsMatch(path.split('/'), call.path.split('/'))
  );
}

export function serverRoutes(root: string): string[] {
  const routes = new Set<string>();
  for (const file of serverRouteFolders.flatMap((folder) =>
    filesUnder(root, folder),
  ))
    for (const [, method = '', path = ''] of readFileSync(
      join(root, file),
      'utf8',
    ).matchAll(serverRoute))
      routes.add(`${method.toUpperCase()} /api${path}`);
  return [...routes].toSorted();
}
