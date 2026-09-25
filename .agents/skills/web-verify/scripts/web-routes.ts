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

export type WebCall = {
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
};

const unknown = '\u0001';
const alternativesLimit = 32;
const transportCallee = /(?:^|[a-z])(?:transport|Transport)$/;
const apiLayer = [
  /^apps\/web\/src\/features\/[^/]+\/api\.ts$/,
  /^apps\/web\/src\/features\/[^/]+\/api\/[^/]+\.ts$/,
  /^apps\/web\/src\/shared\/(?:api|live)\/[^/]+\.ts$/,
];

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

function moduleFile(root: string, from: string, specifier: string) {
  const base = specifier.startsWith('@/')
    ? join(root, 'apps/web/src', specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(join(root, from)), specifier)
      : undefined;
  if (base === undefined) return undefined;
  const found = [base, `${base}.ts`, `${base}.tsx`].find(
    (candidate) => existsSync(candidate) && candidate.match(/\.tsx?$/),
  );
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

  constructor(root: string) {
    this.root = root;
  }

  module(file: string): Module {
    const known = this.modules.get(file);
    if (known) return known;
    const loaded: Module = {
      file,
      values: new Map(),
      functions: new Map(),
      imports: new Map(),
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
        const from = moduleFile(this.root, file, node.source.value);
        if (from === undefined) return;
        for (const specifier of node.specifiers)
          if (specifier.type === 'ImportSpecifier')
            loaded.imports.set(specifier.local.name, {
              from,
              name:
                specifier.imported.type === 'Identifier'
                  ? specifier.imported.name
                  : specifier.imported.value,
            });
      },
    }).visit(parseSync(file, source).program);
    return loaded;
  }

  private functionsNamed(module: Module, name: string): [Module, Callable][] {
    const local = module.functions.get(name) ?? [];
    if (local.length > 0) return local.map((callable) => [module, callable]);
    const imported = module.imports.get(name);
    if (imported === undefined) return [];
    const target = this.module(imported.from);
    return this.functionsNamed(target, imported.name);
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

export function webCalls(root: string): {
  calls: WebCall[];
  problems: string[];
} {
  const reader = new RouteReader(root);
  const calls: WebCall[] = [];
  const problems: string[] = [];
  const files = filesUnder(root, 'apps/web/src')
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => apiLayer.some((pattern) => pattern.test(path)))
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
          `${file}:${line}: the coverage check cannot read the route this call reaches; build the path from literals, encodeURIComponent and path helpers, and name the method as a literal.`,
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

export function calledRoutes(
  calls: readonly WebCall[],
  registered: readonly string[],
): { routes: Map<string, WebCall[]>; problems: string[] } {
  const network = registered.filter((route) => !route.startsWith('owner '));
  const routes = new Map<string, WebCall[]>();
  const problems: string[] = [];
  for (const call of calls) {
    const segments = call.path.split('/');
    const candidates = network.filter((route) => {
      const [method = '', path = ''] = route.split(' ');
      return method === call.method && segmentsMatch(path.split('/'), segments);
    });
    const route =
      candidates.find((candidate) => candidate.endsWith(` ${call.path}`)) ??
      candidates[0];
    if (route === undefined) {
      problems.push(
        `${call.file}:${call.line}: the web calls ${call.method} ${call.path}, which the server does not register.`,
      );
      continue;
    }
    routes.set(route, [...(routes.get(route) ?? []), call]);
  }
  return { routes, problems };
}
