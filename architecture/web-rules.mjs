import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, shadcnRegistry, webPart } from './policy.ts';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url)).replaceAll(
  '\\',
  '/',
);
const webSource = 'apps/web/src/';
const reactModules = new Set(['react', 'react-dom']);
const queryModules = new Set(['@tanstack/react-query', '@tanstack/query-core']);
const zustandModule = /^zustand(?:\/|$)/;
const routerDataHooks = new Set([
  'getRouteApi',
  'useLoaderData',
  'useLoaderDeps',
  'useMatch',
  'useMatches',
  'useParams',
  'useRouteContext',
  'useRouterState',
  'useSearch',
]);
const readHooks = new Set([
  'useQuery',
  'useSuspenseQuery',
  'useQueries',
  'useSuspenseQueries',
  'useInfiniteQuery',
  'useSuspenseInfiniteQuery',
  'queryOptions',
  'infiniteQueryOptions',
]);
const writeHooks = new Set(['useMutation', 'mutationOptions']);
const promiseContinuations = new Set(['then', 'catch', 'finally']);
const cacheWrites = new Set([
  'setQueryData',
  'setQueriesData',
  'invalidateQueries',
  'removeQueries',
  'resetQueries',
  'refetchQueries',
  'cancelQueries',
]);
const timerGlobals = new Set(['setTimeout', 'setInterval']);
const storageGlobals = new Set(['localStorage', 'sessionStorage']);
const globalObjects = new Set(['window', 'globalThis', 'self']);
const ioGlobals = new Set([
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'fetch',
  'WebSocket',
  'EventSource',
  'XMLHttpRequest',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'console',
]);
const dialogRoles = new Set(['dialog', 'alertdialog']);
const keyTargets = new Set([...globalObjects, 'document']);
const keyEvents = new Set(['keydown', 'keyup', 'keypress']);
const historyGlobals = new Set(['history']);
const pureRuleModules =
  /^(?:@porcelain\/contracts(?:\/|$)|@porcelain\/client\/[^/]+\/rules$|date-fns(?:\/|$))/;
const loopStatements = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);
const iterationMethods = new Set([
  'forEach',
  'map',
  'flatMap',
  'reduce',
  'filter',
  'some',
  'every',
  'find',
]);
const functionTypes = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);
const nativePrimitives = new Set([
  'button',
  'dialog',
  'input',
  'label',
  'progress',
  'select',
  'textarea',
]);
const shadcnNames = new Set(
  [...shadcnRegistry].map((name) =>
    name
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(''),
  ),
);
const testFunctions = new Set(['test', 'it', 'describe', 'suite']);
const caseFunctions = new Set(['test', 'it']);
const skipMembers = new Set([
  'skip',
  'only',
  'todo',
  'fails',
  'skipIf',
  'runIf',
]);
const journeyRoles = new Set(['integration-spec', 'e2e-spec']);
const journeyImports = {
  'integration-spec': {
    local: /^(?:\.\/fixtures\.tsx|\.\.\/kit\/[a-z0-9-]+\.ts)$/,
    packages: new Map([
      ['vitest', new Set(['expect', 'describe'])],
      ['vitest/browser', new Set(['page', 'userEvent'])],
    ]),
  },
  'e2e-spec': {
    local: /^(?:\.\/fixtures\.ts|\.\.\/kit\/[a-z0-9-]+\.ts)$/,
    packages: new Map(),
  },
};
const networkRoutes = new Set([
  'route',
  'routeWebSocket',
  'routeFromHAR',
  'unroute',
  'unrouteAll',
]);
const playwrightSkips = new Set([
  'fixme',
  'slow',
  'fail',
  'setTimeout',
  'configure',
]);
const retryingAssertions = new Set(['element', 'poll']);
const journeyLocatorReads = new Set([
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'getElementsByClassName',
  'getElementsByName',
  'getElementsByTagName',
  'closest',
  'locator',
  'elementLocator',
  'getByTestId',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
  'element',
  'elements',
  'query',
]);
const journeyNamedLocators = new Map([
  ['getByRole', 'options'],
  ['getByText', 'argument'],
  ['getByLabelText', 'argument'],
]);
const journeyTimers = new Set([
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'requestIdleCallback',
]);
const journeyWaits = /^(?:sleep|delay|wait|pause|waitForTimeout)$/i;
const journeyBypasses = new Set([
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'document',
  'window',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'navigator',
  'globalThis',
  'self',
]);

function importedName(specifier) {
  return specifier.imported.type === 'Identifier'
    ? specifier.imported.name
    : specifier.imported.value;
}

function objectProperty(node, key) {
  if (node?.type !== 'ObjectExpression') return undefined;
  const found = node.properties.find(
    (property) =>
      property.type === 'Property' &&
      !property.computed &&
      ((property.key.type === 'Identifier' && property.key.name === key) ||
        (property.key.type === 'Literal' && property.key.value === key)),
  );
  return found?.value;
}

function patternNode(node) {
  return (
    (node.type === 'Literal' && node.regex?.pattern !== undefined) ||
    (node.type === 'NewExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'RegExp')
  );
}

function journeyRole(context) {
  const role = webPart(webPath(context));
  return journeyRoles.has(role) ? role : undefined;
}

function journeyRule(visitors) {
  return {
    create(context) {
      const role = journeyRole(context);
      if (role === undefined) return {};
      return visitors(context, role);
    },
  };
}

function chainTop(node) {
  let current = node;
  while (
    (current.parent?.type === 'MemberExpression' &&
      current.parent.object === current) ||
    (current.parent?.type === 'CallExpression' &&
      current.parent.callee === current)
  )
    current = current.parent;
  return current;
}

function chainMembers(node) {
  const names = [];
  let current = node;
  while (
    (current.parent?.type === 'MemberExpression' &&
      current.parent.object === current) ||
    (current.parent?.type === 'CallExpression' &&
      current.parent.callee === current)
  ) {
    current = current.parent;
    if (
      current.type === 'MemberExpression' &&
      current.property.type === 'Identifier'
    )
      names.push(current.property.name);
  }
  return names;
}

function awaitedExpect(node, role) {
  if (node.callee.type !== 'Identifier' || node.callee.name !== 'expect')
    return false;
  const outer = chainTop(node).parent;
  if (
    outer?.type === 'CallExpression' &&
    outer.callee.type === 'Identifier' &&
    outer.callee.name === 'expect'
  )
    return awaitedExpect(outer, role);
  if (outer?.type !== 'AwaitExpression') return false;
  if (role === 'e2e-spec') return true;
  const members = chainMembers(node);
  return members.includes('rejects') || members.includes('resolves');
}

function expectCall(node) {
  return node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'expect' &&
    node.callee.property.type === 'Identifier'
    ? node.callee.property.name
    : undefined;
}

function retryingMatcher(node) {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression')
    return false;
  let current = node.callee.object;
  while (current.type === 'MemberExpression') current = current.object;
  return retryingAssertions.has(expectCall(current) ?? '');
}

function enclosingFunction(context, node) {
  return context.sourceCode
    .getAncestors(node)
    .reverse()
    .find((ancestor) => functionTypes.has(ancestor.type));
}

function caseBody(node) {
  if (node.type !== 'CallExpression') return undefined;
  const root = rootName(node.callee);
  if (!caseFunctions.has(root ?? '')) return undefined;
  const body = node.arguments.at(-1);
  return body && functionTypes.has(body.type) ? body : undefined;
}

function webPath(context) {
  const path = context.filename.replaceAll('\\', '/');
  return path.startsWith(repositoryRoot)
    ? path.slice(repositoryRoot.length)
    : path;
}

function runtimeWeb(path) {
  return (
    (path.startsWith(webSource) ||
      path.startsWith('apps/mobile/src/') ||
      path.startsWith('packages/client/src/')) &&
    webPart(path) !== 'ui'
  );
}

function inWeb(path) {
  return path.startsWith('apps/web/') && webPart(path) !== 'ui';
}

function viewLike(path) {
  const part = webPart(path);
  return part === 'view' || part === 'shell';
}

function sourceOf(node) {
  const source = node.source;
  return source?.type === 'Literal' && typeof source.value === 'string'
    ? source.value
    : undefined;
}

function localTarget(path, specifier) {
  if (specifier.startsWith('@/')) return specifier.slice('@/'.length);
  if (!specifier.startsWith('.') || !path.startsWith(webSource))
    return undefined;
  return posix.join(
    posix.dirname(path.slice(webSource.length)),
    specifier.replace(/\.tsx?$/, ''),
  );
}

function importedFrom(program, accept) {
  const locals = new Map();
  const namespaces = new Set();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const source = sourceOf(statement);
    if (source === undefined || !accept(source)) continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportSpecifier')
        locals.set(
          specifier.local.name,
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value,
        );
      else namespaces.add(specifier.local.name);
    }
  }
  return { locals, namespaces };
}

function calledImport(callee, imports) {
  if (callee.type === 'Identifier') return imports.locals.get(callee.name);
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    imports.namespaces.has(callee.object.name) &&
    callee.property.type === 'Identifier'
  )
    return callee.property.name;
  return undefined;
}

function methodName(callee) {
  return callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
    ? callee.property.name
    : undefined;
}

function promiseContinuationName(callee) {
  if (callee.type !== 'MemberExpression') return undefined;
  if (!callee.computed) return methodName(callee);
  return callee.property.type === 'Literal' &&
    typeof callee.property.value === 'string'
    ? callee.property.value
    : undefined;
}

function rootName(node) {
  let current = node;
  while (current?.type === 'MemberExpression') current = current.object;
  return current?.type === 'Identifier' ? current.name : undefined;
}

function globalScope(context, program) {
  let scope = context.sourceCode.getScope(program);
  while (scope.upper) scope = scope.upper;
  return scope;
}

function globalUses(context, program, names) {
  const scope = globalScope(context, program);
  const builtin = [...names].flatMap(
    (name) => scope.set.get(name)?.references ?? [],
  );
  const direct = [...scope.through, ...builtin]
    .filter((reference) => names.has(reference.identifier.name))
    .map((reference) => reference.identifier);
  const viaGlobal = [
    ...scope.through,
    ...[...globalObjects].flatMap(
      (name) => scope.set.get(name)?.references ?? [],
    ),
  ]
    .filter((reference) => globalObjects.has(reference.identifier.name))
    .map((reference) => reference.identifier.parent)
    .filter(
      (member) =>
        member?.type === 'MemberExpression' &&
        !member.computed &&
        member.property.type === 'Identifier' &&
        names.has(member.property.name),
    );
  return [...direct, ...viaGlobal];
}

function hookBan({ names, modules, allowed, message }) {
  return {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || allowed(path)) return {};
      let imports = { locals: new Map(), namespaces: new Set() };
      return {
        Program(program) {
          imports = importedFrom(program, (source) => modules.has(source));
        },
        CallExpression(node) {
          const name = calledImport(node.callee, imports);
          if (name !== undefined && names.has(name))
            context.report({ node, message: message(name) });
        },
      };
    },
  };
}

function never() {
  return false;
}

function viewRule(visitors) {
  return {
    create(context) {
      const path = webPath(context);
      if (!viewLike(path)) return {};
      return visitors(context, path);
    },
  };
}

function pageCode(path) {
  return (
    path.startsWith(`${webSource}app/`) ||
    webPart(path) === 'view' ||
    (path.startsWith(`${webSource}shared/`) && path.endsWith('.tsx'))
  );
}

function pageRule(visitors) {
  return {
    create(context) {
      return pageCode(webPath(context)) ? visitors(context) : {};
    },
  };
}

function stringValue(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string')
    return node.value;
  if (node?.type === 'JSXExpressionContainer')
    return stringValue(node.expression);
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

function commandCalls(body, visitorKeys) {
  const calls = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node !== body && functionTypes.has(node.type)) return;
    if (node.type === 'CallExpression') {
      const method = methodName(node.callee);
      if (method === 'mutate' || method === 'mutateAsync') calls.push(node);
    }
    for (const key of visitorKeys[node.type] ?? []) {
      const child = node[key];
      for (const entry of Array.isArray(child) ? child : [child]) visit(entry);
    }
  };
  visit(body);
  return calls;
}

export const webRules = {
  'client-platform-through-ports': {
    create(context) {
      const path = webPath(context);
      if (!path.startsWith('packages/client/src/')) return {};
      const message =
        'The shared client receives platform capabilities through ports and uses native Effect services and Atom state; React bindings, browser globals, Expo and native UI stay in each app so incompatible React runtimes cannot mix.';
      const check = (node) => {
        const source = sourceOf(node);
        if (
          source !== undefined &&
          /^(?:react(?:-native|-dom)?|@effect\/atom-react|@tanstack\/react-query|expo(?:-[^/]+)?|@expo\/[^/]+)(?:\/|$)/.test(
            source,
          )
        )
          context.report({ node, message });
      };
      return {
        ImportDeclaration: check,
        ImportExpression: check,
        ExportNamedDeclaration: check,
        ExportAllDeclaration: check,
        'Program:exit'(program) {
          for (const node of globalUses(
            context,
            program,
            new Set([
              'window',
              'document',
              'navigator',
              'location',
              'history',
              'localStorage',
              'sessionStorage',
            ]),
          ))
            context.report({ node, message });
        },
      };
    },
  },
  'web-no-module-mutable-binding': {
    create(context) {
      if (!runtimeWeb(webPath(context))) return {};
      return {
        Program(program) {
          for (const statement of program.body) {
            const declaration =
              statement.type === 'ExportNamedDeclaration'
                ? statement.declaration
                : statement;
            if (
              declaration?.type === 'VariableDeclaration' &&
              declaration.kind !== 'const'
            )
              context.report({
                node: declaration,
                message:
                  'Put client state and counters in the feature store.ts, because module-level mutable bindings bypass subscribers.',
              });
          }
        },
      };
    },
  },
  'web-no-context': hookBan({
    names: new Set(['createContext', 'useContext']),
    modules: reactModules,
    allowed: never,
    message: (name) =>
      `\`${name}\` is not ours here: shared client state is the feature store.ts and server data is Query; a provider hides who owns the value, because a provider hides ownership of shared client state.`,
  }),
  'web-no-action-hooks': hookBan({
    names: new Set(['useOptimistic', 'useActionState', 'useFormStatus']),
    modules: reactModules,
    allowed: never,
    message: (name) =>
      `\`${name}\` is not ours here: writes are commands/ mutations, optimistic updates live in the command, and form state is TanStack Form, because writes and optimistic updates need one command owner.`,
  }),
  'web-no-manual-memo': hookBan({
    names: new Set(['useMemo', 'useCallback']),
    modules: reactModules,
    allowed: never,
    message: (name) =>
      `\`${name}\` is not ours here: the React Compiler memoizes every component; hand memoization hides what it cannot compile, because hand memoization hides failures of the compiler used by the build.`,
  }),
  'web-store-owns-atoms': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path)) return {};
      const part = webPart(path);
      const message =
        'Native Atom state has one feature owner: mutable AtomRef values and persisted atoms belong to store.ts; queries and commands own async atoms, because competing stores or view-created atoms split subscriptions and cancellation. Zustand is retired.';
      let atoms = { locals: new Map(), namespaces: new Set() };
      let methods = { locals: new Map(), namespaces: new Set() };
      return {
        Program(program) {
          atoms = importedFrom(
            program,
            (source) => source === 'effect/reactivity',
          );
          methods = importedFrom(
            program,
            (source) => source === 'effect/reactivity/Atom',
          );
        },
        CallExpression(node) {
          const callee = node.callee;
          if (
            part !== 'store' &&
            (calledImport(callee, methods) === 'kvs' ||
              (callee.type === 'MemberExpression' &&
                promiseContinuationName(callee) === 'kvs' &&
                calledImport(callee.object, atoms) === 'Atom'))
          )
            context.report({ node, message });
        },
        ImportDeclaration(node) {
          const source = sourceOf(node) ?? '';
          if (zustandModule.test(source)) {
            context.report({ node, message });
            return;
          }
          if (node.importKind === 'type') return;
          for (const binding of node.specifiers) {
            if (binding.importKind === 'type') continue;
            const imported = source.startsWith('effect/reactivity/')
              ? source.slice('effect/reactivity/'.length)
              : source === 'effect/reactivity' &&
                  binding.type === 'ImportSpecifier'
                ? importedName(binding)
                : source === 'effect/reactivity'
                  ? '*'
                  : undefined;
            if (
              (['AtomRef', '*'].includes(imported) && part !== 'store') ||
              (['Atom', '*'].includes(imported) &&
                ['view', 'route'].includes(part))
            )
              context.report({ node: binding, message });
          }
        },
      };
    },
  },
  'web-store-owns-storage': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || ['store', 'adapter'].includes(webPart(path)))
        return {};
      return {
        'Program:exit'(program) {
          for (const node of globalUses(context, program, storageGlobals))
            context.report({
              node,
              message:
                'Web Storage belongs to a feature store or its platform adapter; the shared Effect store owns persistence policy, so views and commands cannot bypass failure recovery.',
            });
        },
      };
    },
  },
  'web-queries-own-reads': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || webPart(path) === 'query') return {};
      let imports = { locals: new Map(), namespaces: new Set() };
      return {
        Program(program) {
          imports = importedFrom(program, (source) => queryModules.has(source));
        },
        CallExpression(node) {
          const name = calledImport(node.callee, imports);
          if (name !== undefined && readHooks.has(name))
            context.report({
              node,
              message: `\`${name}\` belongs to features/<domain>/queries/: one queryOptions factory and the read hook views use, per resource, because duplicated read definitions can use inconsistent keys or freshness.`,
            });
        },
        Property(node) {
          if (
            !node.computed &&
            node.key.type === 'Identifier' &&
            node.key.name === 'queryKey' &&
            node.value.type === 'ArrayExpression'
          )
            context.report({
              node,
              message:
                'A query key is built in features/<domain>/queries/ only; elsewhere read it from the factory as options.queryKey, because duplicated read definitions can use inconsistent keys or freshness.',
            });
        },
      };
    },
  },
  'web-queries-export-reads': {
    create(context) {
      if (webPart(webPath(context)) !== 'query') return {};
      const message =
        'A queries/ file exports only queryOptions factories, native reads and read hooks; pure decisions belong in rules/, and re-exports belong in index.ts, because mixing decisions with reads hides their independent owner.';
      const readName = (name) =>
        /^(?:use|read)[A-Z]/.test(name) || /QueryOptions$/.test(name);
      return {
        ExportAllDeclaration(node) {
          context.report({ node, message });
        },
        ExportDefaultDeclaration(node) {
          context.report({ node, message });
        },
        ExportNamedDeclaration(node) {
          if (node.source || node.specifiers.length > 0) {
            context.report({ node, message });
            return;
          }
          const declaration = node.declaration;
          const names =
            declaration?.type === 'FunctionDeclaration'
              ? [declaration.id?.name]
              : declaration?.type === 'VariableDeclaration'
                ? declaration.declarations.map((entry) =>
                    entry.id.type === 'Identifier' ? entry.id.name : undefined,
                  )
                : [];
          if (names.length === 0 || names.some((name) => !readName(name ?? '')))
            context.report({ node, message });
        },
      };
    },
  },
  'web-commands-own-writes': hookBan({
    names: writeHooks,
    modules: queryModules,
    allowed: (path) => webPart(path) === 'command',
    message: (name) =>
      `\`${name}\` belongs to features/<domain>/commands/: one mutation and the command hook views use, per write, because one command must own mutation completion and optimistic updates.`,
  }),
  'web-cache-writes-in-commands': {
    create(context) {
      const path = webPath(context);
      const part = webPart(path);
      if (
        !runtimeWeb(path) ||
        part === 'command' ||
        part === 'live' ||
        /^packages\/client\/src\/.+\.spec\.ts$/.test(path)
      )
        return {};
      return {
        CallExpression(node) {
          const name = methodName(node.callee);
          if (name !== undefined && cacheWrites.has(name))
            context.report({
              node,
              message: `\`${name}\` writes the Query cache, which only a command in features/<domain>/commands/ or the feature live.ts does; everyone else reads it, because uncoordinated cache changes can race optimistic mutations.`,
            });
        },
      };
    },
  },
  'web-overlays-own-handles': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || webPart(path) === 'overlays') return {};
      return {
        CallExpression(node) {
          const name =
            node.callee.type === 'Identifier'
              ? node.callee.name
              : methodName(node.callee);
          if (name === 'createHandle')
            context.report({
              node,
              message:
                'A Base UI handle is created in the feature overlays.ts only, so every trigger and every command opens the same overlay.',
            });
        },
      };
    },
  },
  'web-api-owns-request': {
    create(context) {
      const path = webPath(context);
      const part = webPart(path);
      if (
        !runtimeWeb(path) ||
        (path.startsWith('packages/client/') &&
          (part === 'api' ||
            path.startsWith('packages/client/src/shared/api/')))
      )
        return {};
      const check = (node) => {
        const specifier = sourceOf(node);
        if (specifier === undefined) return;
        if (
          ((specifier === 'effect/http-api' ||
            specifier === 'effect/http-api/HttpApiClient') &&
            (node.type === 'ImportExpression' ||
              node.type === 'ExportAllDeclaration' ||
              specifier === 'effect/http-api/HttpApiClient' ||
              node.specifiers?.some(
                (binding) =>
                  binding.type === 'ImportNamespaceSpecifier' ||
                  binding.imported?.name === 'HttpApiClient' ||
                  binding.imported?.value === 'HttpApiClient' ||
                  (node.type === 'ExportNamedDeclaration' &&
                    binding.local?.name === 'HttpApiClient'),
              ))) ||
          (specifier.startsWith('.') &&
            /(?:^|\/)shared\/api\/effect-client(?:\.ts)?$/.test(
              posix.normalize(posix.join(posix.dirname(path), specifier)),
            ) &&
            (node.type === 'ImportExpression' ||
              node.type === 'ExportAllDeclaration' ||
              node.specifiers?.some(
                (binding) =>
                  binding.type === 'ImportNamespaceSpecifier' ||
                  binding.imported?.name === 'transportClient',
              )))
        )
          context.report({
            node,
            message:
              'Only the shared feature api.ts constructs the typed HTTP client; queries and commands use that API, because codec and transport policy must have one owner for every app.',
          });
      };
      return {
        ImportDeclaration: check,
        ImportExpression: check,
        ExportNamedDeclaration: check,
        ExportAllDeclaration: check,
      };
    },
  },
  'web-transport-owner': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path)) return {};
      const inside = path.replace(
        /^(?:apps\/(?:web|mobile)|packages\/client)\/src\//,
        '',
      );
      const globalCallee = (callee, names) =>
        (callee.type === 'Identifier' && names.has(callee.name)) ||
        (callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          globalObjects.has(callee.object.name) &&
          callee.property.type === 'Identifier' &&
          names.has(callee.property.name));
      return {
        CallExpression(node) {
          if (
            globalCallee(node.callee, new Set(['fetch'])) &&
            !inside.startsWith('shared/api/')
          )
            context.report({
              node,
              message:
                'Network requests belong in shared/api; a feature reaches them through its api.ts, because connection setup and errors need one transport owner.',
            });
        },
        NewExpression(node) {
          if (
            globalCallee(node.callee, new Set(['WebSocket', 'EventSource'])) &&
            !/^apps\/(?:web|mobile)\/src\/shared\/adapters\/live-socket\.ts$/.test(
              path,
            )
          )
            context.report({
              node,
              message:
                'Construct sockets only in the app shared/adapters/live-socket.ts and supply them to packages/client/live, because the shared Effect lifecycle owns reconnects, cancellation and protocol handling for every client.',
            });
        },
      };
    },
  },
  'web-timers-in-commands-and-store': {
    create(context) {
      const path = webPath(context);
      const part = webPart(path);
      if (!runtimeWeb(path) || part === 'command' || part === 'store')
        return {};
      return {
        'Program:exit'(program) {
          for (const node of globalUses(context, program, timerGlobals))
            context.report({
              node,
              message:
                'A timer lives in features/<domain>/commands/ or the feature store.ts, where the work it delays is owned; a view never schedules, because the owner of delayed work must also own its cancellation.',
            });
        },
      };
    },
  },
  'web-rules-are-pure': {
    create(context) {
      const path = webPath(context);
      if (webPart(path) !== 'web-rule') return {};
      const message =
        'features/<domain>/rules/ holds pure functions: no React, no I/O, only sibling rules, config/limits.ts, contracts and date-fns, because a decision must not depend on browser state or perform effects.';
      const check = (node) => {
        const specifier = sourceOf(node);
        if (specifier === undefined) return;
        const target = localTarget(path, specifier);
        const sibling =
          specifier.startsWith('./') && !specifier.slice(2).includes('/');
        if (
          target === 'config/limits' ||
          (specifier.startsWith('.') &&
            classify(
              posix.normalize(posix.join(posix.dirname(path), specifier)),
            )?.role === 'web-limits') ||
          sibling ||
          (target === undefined && pureRuleModules.test(specifier))
        )
          return;
        context.report({ node, message });
      };
      return {
        ImportDeclaration: check,
        ImportExpression: check,
        ExportNamedDeclaration: check,
        ExportAllDeclaration: check,
        'Program:exit'(program) {
          for (const node of globalUses(context, program, ioGlobals))
            context.report({ node, message });
        },
      };
    },
  },
  'web-views-no-await': viewRule((context) => ({
    AwaitExpression(node) {
      context.report({
        node,
        message:
          'A view does not await: it calls a command hook and renders the command state; the async work lives in commands/, because commands must own completion state across view unmounts.',
      });
    },
    ForOfStatement(node) {
      if (node.await)
        context.report({
          node,
          message:
            'A view does not await: it calls a command hook and renders the command state; the async work lives in commands/, because commands must own completion state across view unmounts.',
        });
    },
  })),
  'web-views-no-promise-chains': viewRule((context) => ({
    CallExpression(node) {
      if (!promiseContinuations.has(promiseContinuationName(node.callee)))
        return;
      context.report({
        node,
        message:
          'A view does not sequence promise completion: put success and error work in a command hook and let the view forward the event, because commands must own completion state across view unmounts.',
      });
    },
  })),
  'web-views-no-try': viewRule((context) => ({
    TryStatement(node) {
      context.report({
        node,
        message:
          'A view does not catch: a failed command reports through its hook state and the route error view; recovery lives in commands/, because command failures must reach command state or the error view.',
      });
    },
  })),
  'web-views-no-command-loops': viewRule((context) => {
    const bodies = [];
    const message =
      'A view does not loop over a command: a write that spans many items is one command in commands/ that takes the list, because one command must coordinate completion of a multi-item write.';
    return {
      ...Object.fromEntries(
        [...loopStatements].map((type) => [
          type,
          (node) => bodies.push(node.body),
        ]),
      ),
      CallExpression(node) {
        const callback = node.arguments[0];
        if (
          iterationMethods.has(methodName(node.callee) ?? '') &&
          callback &&
          functionTypes.has(callback.type)
        )
          bodies.push(callback.body);
      },
      'Program:exit'() {
        for (const body of bodies)
          for (const node of commandCalls(body, context.sourceCode.visitorKeys))
            context.report({ node, message });
      },
    };
  }),
  'web-views-no-direct-data': viewRule((context, path) => ({
    ImportDeclaration(node) {
      const specifier = sourceOf(node) ?? '';
      const target = localTarget(path, specifier);
      const direct =
        queryModules.has(specifier) ||
        zustandModule.test(specifier) ||
        target === 'shared/query' ||
        target?.startsWith('shared/query/') === true;
      if (direct) {
        context.report({
          node,
          message:
            'A view reads data through the feature hooks in queries/, commands/ and store.ts, not through TanStack Query, Zustand or the query client directly, because feature hooks own query and store subscriptions.',
        });
        return;
      }
      if (specifier !== '@tanstack/react-router') return;
      for (const specifierNode of node.specifiers)
        if (
          specifierNode.type === 'ImportSpecifier' &&
          routerDataHooks.has(
            specifierNode.imported.type === 'Identifier'
              ? specifierNode.imported.name
              : specifierNode.imported.value,
          )
        )
          context.report({
            node: specifierNode,
            message:
              'A view gets route data as props from its route, which reads loader data, params and search; the view stays reusable outside that route, because feature hooks own query and store subscriptions.',
          });
    },
  })),
  'web-views-no-transport': viewRule((context, path) => {
    const check = (node) => {
      const target = localTarget(path, sourceOf(node) ?? '');
      if (target === undefined) return;
      if (
        /^shared\/(?:api|live)(?:\/|$)/.test(target) ||
        /^features\/[^/]+\/api(?:\/|$)/.test(target)
      )
        context.report({
          node,
          message:
            'A view calls feature hooks from queries/ and commands/, never the transport, the live socket or the feature api.ts, because transport calls bypass command state and query lifecycle.',
        });
    };
    return {
      ImportDeclaration: check,
      ImportExpression: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  }),
  'web-views-no-contracts': viewRule((context) => ({
    ImportDeclaration(node) {
      if ((sourceOf(node) ?? '').startsWith('@porcelain/contracts'))
        context.report({
          node,
          message:
            'A view receives feature data; the contract is read and parsed in api.ts, queries/ and commands/, because transport shapes must be converted before reaching a view.',
        });
    },
  })),
  'web-dialogs-from-ui': pageRule((context) => ({
    JSXAttribute(node) {
      if (
        node.name.type === 'JSXIdentifier' &&
        node.name.name === 'role' &&
        dialogRoles.has(stringValue(node.value) ?? '')
      )
        context.report({
          node,
          message:
            'A dialog is Dialog, AlertDialog or Sheet from components/ui, which bring the role, the focus trap, Escape and the overlay; a page is a route. A hand-set dialog role copies them badly and fools the journeys that find it, because registry dialogs provide focus trapping, Escape and accessible roles.',
        });
    },
  })),
  'web-keys-through-hotkeys': pageRule((context) => ({
    CallExpression(node) {
      const callee = node.callee;
      if (
        callee.type !== 'MemberExpression' ||
        methodName(callee) !== 'addEventListener' ||
        callee.object.type !== 'Identifier' ||
        !keyTargets.has(callee.object.name) ||
        !keyEvents.has(stringValue(node.arguments[0]) ?? '')
      )
        return;
      context.report({
        node,
        message:
          'A keyboard shortcut is useHotkey from @tanstack/react-hotkeys with its keys in shared/workspace/shortcuts.ts, which scopes it and lists it in the shortcuts dialog; a window or document key listener fights every other shortcut and the editor. A key that belongs to one element is its onKeyDown, because global key listeners fight other shortcuts and the editor.',
      });
    },
  })),
  'web-navigation-through-router': pageRule((context) => ({
    'Program:exit'(program) {
      for (const node of globalUses(context, program, historyGlobals))
        context.report({
          node,
          message:
            "Navigation goes through TanStack Router: Link, useNavigate, useCanGoBack and useRouter().history.back(); window.history moves the page behind the router's back, so its location, loaders and blockers go stale.",
        });
    },
  })),
  'web-no-empty-catch': {
    create(context) {
      if (!inWeb(webPath(context))) return {};
      return {
        CatchClause(node) {
          if (node.body.body.length === 0)
            context.report({
              node,
              message:
                'An empty catch swallows the failure; let it reach the command state or the error view, or handle it by name, because swallowing errors hides failed commands from the user.',
            });
        },
      };
    },
  },
  'web-shadcn-wrapper': {
    create(context) {
      if (!inWeb(webPath(context))) return {};
      return {
        JSXOpeningElement(node) {
          if (node.name.type !== 'JSXIdentifier') return;
          if (
            !nativePrimitives.has(node.name.name) &&
            !shadcnNames.has(node.name.name)
          )
            return;
          if (
            node.attributes.some(
              (attribute) =>
                attribute.type === 'JSXSpreadAttribute' &&
                attribute.argument.type === 'Identifier' &&
                attribute.argument.name === 'props',
            )
          )
            context.report({
              node,
              message:
                'Forwarding generic props through another primitive duplicates shadcn; use its registry component and variants in the feature view, because another generic primitive duplicates the registry component.',
            });
        },
      };
    },
  },
  'web-browser-spec-no-mocks': {
    create(context) {
      const role = journeyRole(context);
      if (role === undefined) return {};
      const message =
        'Browser behaviour runs against the real isolated server; vi mocks, spies, stubs and routed requests have no place in a browser case, and a race the test must reach goes through the kit fixtures that own it, because mocked transport cannot prove the real app and server agree.';
      return {
        CallExpression(node) {
          if (
            role === 'e2e-spec' &&
            node.callee.type === 'MemberExpression' &&
            !node.callee.computed &&
            node.callee.property.type === 'Identifier' &&
            networkRoutes.has(node.callee.property.name)
          )
            context.report({ node, message });
        },
        ImportDeclaration(node) {
          if (sourceOf(node) !== 'vitest') return;
          for (const specifier of node.specifiers)
            if (
              specifier.type !== 'ImportSpecifier' ||
              (specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : specifier.imported.value) === 'vi'
            )
              context.report({ node: specifier, message });
        },
        MemberExpression(node) {
          if (node.object.type === 'Identifier' && node.object.name === 'vi')
            context.report({ node, message });
        },
      };
    },
  },
  'web-browser-spec-no-skips': {
    create(context) {
      const role = journeyRole(context);
      if (role === undefined) return {};
      const message =
        'Every test runs every time, once, and must pass at once; remove the skip, only, todo, fails, fixme, slow, fail, configure, setTimeout or the options object that sets retry, repeats or a timeout. Repetition is the runner option an investigation asks for, because retries and skips can hide an intermittent product failure.';
      return {
        MemberExpression(node) {
          if (
            testFunctions.has(rootName(node) ?? '') &&
            (node.computed ||
              (node.property.type === 'Identifier' &&
                (skipMembers.has(node.property.name) ||
                  (role === 'e2e-spec' &&
                    playwrightSkips.has(node.property.name)))))
          )
            context.report({ node, message });
        },
        CallExpression(node) {
          if (
            testFunctions.has(rootName(node.callee) ?? '') &&
            node.arguments.some(
              (argument) => argument.type === 'ObjectExpression',
            )
          )
            context.report({ node, message });
        },
      };
    },
  },
  'web-journey-imports': journeyRule((context, role) => {
    const message =
      role === 'e2e-spec'
        ? 'An e2e test imports test, expect and its fixtures from ./fixtures.ts, the shared kit from ../kit/ and @porcelain/contracts; the app and the server are reached only through the fixtures, which open the app the way a user does, because fixtures own isolation and pair the app as a user would.'
        : 'An integration test imports test, expect and its fixtures from ./fixtures.tsx, the shared kit from ../kit/, expect and describe from vitest, page and userEvent from vitest/browser, and @porcelain/contracts; the feature is rendered only through the fixtures, which pair and provide it the way the app does, because fixtures own isolation and pair the app as a user would.';
    const allowed = journeyImports[role];
    const check = (node) => {
      const source = sourceOf(node);
      if (source === undefined) {
        context.report({ node, message });
        return;
      }
      if (source.startsWith('@porcelain/contracts/')) return;
      if (allowed.local.test(source)) return;
      const names = allowed.packages.get(source);
      if (names === undefined || node.type !== 'ImportDeclaration') {
        context.report({ node, message });
        return;
      }
      for (const specifier of node.specifiers)
        if (
          specifier.type !== 'ImportSpecifier' ||
          !names.has(importedName(specifier))
        )
          context.report({ node: specifier, message });
    };
    return {
      ImportDeclaration: check,
      ImportExpression: check,
      ExportNamedDeclaration(node) {
        if (node.source) check(node);
      },
      ExportAllDeclaration: check,
    };
  }),
  'web-journey-asserts': journeyRule((context, role) => {
    const cases = [];
    const asserting = new Set();
    return {
      CallExpression(node) {
        const body = caseBody(node);
        if (body) cases.push({ node, body });
        if (retryingMatcher(node) || awaitedExpect(node, role))
          asserting.add(enclosingFunction(context, node));
      },
      'Program:exit'() {
        for (const { node, body } of cases)
          if (!asserting.has(body))
            context.report({
              node,
              message:
                'Every test case asserts in its own body what the user sees, with an awaited Playwright expect or Vitest expect.element, or what the server kept, with expect.poll; a case without one proves only that nothing threw, because a case without an assertion proves only that nothing threw.',
            });
      },
    };
  }),
  'web-journey-retrying-assertions': journeyRule((context, role) => ({
    CallExpression(node) {
      const message =
        role === 'e2e-spec'
          ? 'An e2e test asserts with an awaited web-first expect for what the page shows and expect.poll over the kit for what the server kept; a synchronous expect reads one moment and races the app, because a synchronous read races the app and server.'
          : 'An integration test asserts with retrying expect.element for what the page shows and expect.poll over the kit for what the server kept; a synchronous expect reads one moment and races the feature, and a bare expect only awaits .rejects or .resolves, because a synchronous read races the app and server.';
      if (node.callee.type === 'Identifier' && node.callee.name === 'expect') {
        if (!awaitedExpect(node, role)) context.report({ node, message });
        return;
      }
      const kind = expectCall(node);
      if (kind === undefined) return;
      if (!retryingAssertions.has(kind)) {
        context.report({ node, message });
        return;
      }
      const subject = node.arguments[0];
      if (
        kind === 'poll' &&
        !(
          subject &&
          (functionTypes.has(subject.type) || subject.type === 'Identifier')
        )
      )
        context.report({ node, message });
    },
  })),
  'web-journey-locators': journeyRule((context) => ({
    CallExpression(node) {
      const method = methodName(node.callee) ?? '';
      if (expectCall(node) === undefined && journeyLocatorReads.has(method)) {
        context.report({
          node,
          message:
            'A journey finds elements by role, label or text, the way a user and assistive technology do; CSS selectors, test ids and element reads couple it to markup and read one moment, because markup selectors couple user journeys to implementation details.',
        });
        return;
      }
      const named = journeyNamedLocators.get(method);
      if (named === undefined) return;
      const [first, second] = node.arguments;
      const name = named === 'options' ? objectProperty(second, 'name') : first;
      if (name === undefined || patternNode(name)) return;
      const exact = objectProperty(second, 'exact');
      if (exact?.type === 'Literal' && exact.value === true) return;
      context.report({
        node,
        message:
          'A journey names an element exactly: pass exact: true with a string name, or a RegExp that states its own bounds; a substring match finds another element whose label contains the text, and a product label is never renamed to dodge one, because markup selectors couple user journeys to implementation details.',
      });
    },
  })),
  'web-journey-no-waits': journeyRule((context) => {
    const message =
      'A journey never waits a fixed time; expect.element and expect.poll retry until the page or the server catches up and fail with what they last saw, because fixed delays race machines with different speeds.';
    return {
      CallExpression(node) {
        const name =
          node.callee.type === 'Identifier'
            ? node.callee.name
            : methodName(node.callee);
        if (journeyWaits.test(name ?? '')) context.report({ node, message });
      },
      'Program:exit'(program) {
        for (const node of globalUses(context, program, journeyTimers))
          context.report({ node, message });
      },
    };
  }),
  'web-journey-through-kit': journeyRule((context) => {
    const message =
      'A journey reaches the page through its locators and the server through the kit server and repo fixtures; the kit owns every /api path and the DOM, so a route or markup change is fixed in one place.';
    const report = (node) => context.report({ node, message });
    return {
      MetaProperty: report,
      Literal(node) {
        if (typeof node.value === 'string' && node.value.includes('/api/'))
          report(node);
      },
      TemplateElement(node) {
        if ((node.value.cooked ?? node.value.raw).includes('/api/'))
          report(node);
      },
      'Program:exit'(program) {
        for (const node of globalUses(context, program, journeyBypasses))
          report(node);
      },
    };
  }),
};
