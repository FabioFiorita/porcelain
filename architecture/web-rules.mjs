import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shadcnRegistry, webPart } from './policy.ts';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url)).replaceAll(
  '\\',
  '/',
);
const VIEW_LINE_BUDGET = 150;
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
const listenerTargets = new Set(['window', 'document', 'globalThis']);
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
const pureRuleModules = /^(?:@porcelain\/contracts(?:\/|$)|date-fns(?:\/|$))/;
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
const journeyImports = new Map([
  ['vitest', new Set(['expect', 'describe'])],
  ['vitest/browser', new Set(['page', 'userEvent'])],
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

function journeyRule(visitors) {
  return {
    create(context) {
      if (webPart(webPath(context)) !== 'browser-spec') return {};
      return visitors(context);
    },
  };
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
  return path.startsWith(webSource) && webPart(path) !== 'ui';
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

function inAdapters(path) {
  return webPart(path) === 'adapter';
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
  'web-no-use-state': hookBan({
    names: new Set(['useState']),
    modules: reactModules,
    allowed: never,
    message: () =>
      '`useState` is not ours here: server data is Query, drafts are TanStack Form, client state is the feature store.ts, overlays are Base UI handles.',
  }),
  'web-no-use-reducer': hookBan({
    names: new Set(['useReducer']),
    modules: reactModules,
    allowed: never,
    message: () =>
      '`useReducer` is not ours here: state that changes by action lives in the feature store.ts, where every view reads the same copy.',
  }),
  'web-no-context': hookBan({
    names: new Set(['createContext', 'useContext']),
    modules: reactModules,
    allowed: never,
    message: (name) =>
      `\`${name}\` is not ours here: shared client state is the feature store.ts and server data is Query; a provider hides who owns the value.`,
  }),
  'web-no-use-sync-external-store': hookBan({
    names: new Set(['useSyncExternalStore']),
    modules: reactModules,
    allowed: never,
    message: () =>
      '`useSyncExternalStore` is not ours here: an outside source reaches views through the feature store.ts, fed by an adapter.',
  }),
  'web-no-action-hooks': hookBan({
    names: new Set(['useOptimistic', 'useActionState', 'useFormStatus']),
    modules: reactModules,
    allowed: never,
    message: (name) =>
      `\`${name}\` is not ours here: writes are commands/ mutations, optimistic updates live in the command, and form state is TanStack Form.`,
  }),
  'web-no-manual-memo': hookBan({
    names: new Set(['useMemo', 'useCallback']),
    modules: reactModules,
    allowed: never,
    message: (name) =>
      `\`${name}\` is not ours here: the React Compiler memoizes every component; hand memoization hides what it cannot compile.`,
  }),
  'web-effects-in-adapters': hookBan({
    names: new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']),
    modules: reactModules,
    allowed: inAdapters,
    message: (name) =>
      `\`${name}\` belongs to features/<domain>/adapters/, the imperative glue for Pierre and the editor; data arrives through Query, commands and live.ts, never through an effect.`,
  }),
  'web-refs-in-adapters': hookBan({
    names: new Set(['useRef']),
    modules: reactModules,
    allowed: inAdapters,
    message: () =>
      '`useRef` belongs to features/<domain>/adapters/, where imperative library glue holds its DOM handles; a view renders data and forwards events.',
  }),
  'web-listeners-in-adapters': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || inAdapters(path)) return {};
      return {
        CallExpression(node) {
          if (
            methodName(node.callee) === 'addEventListener' &&
            listenerTargets.has(rootName(node.callee.object) ?? '')
          )
            context.report({
              node,
              message:
                'A window or document listener belongs to features/<domain>/adapters/; keyboard shortcuts are TanStack Hotkeys and everything else reaches a view as a prop.',
            });
        },
      };
    },
  },
  'web-store-owns-zustand': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || webPart(path) === 'store') return {};
      return {
        ImportDeclaration(node) {
          if (zustandModule.test(sourceOf(node) ?? ''))
            context.report({
              node,
              message:
                'Zustand is created in the feature store.ts only; a view reads it through the hooks store.ts exports.',
            });
        },
      };
    },
  },
  'web-store-owns-storage': {
    create(context) {
      const path = webPath(context);
      if (!runtimeWeb(path) || webPart(path) === 'store') return {};
      return {
        'Program:exit'(program) {
          for (const node of globalUses(context, program, storageGlobals))
            context.report({
              node,
              message:
                'Web Storage is read and written by the feature store.ts only, through Zustand persist, so one owner decides what survives a reload.',
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
              message: `\`${name}\` belongs to features/<domain>/queries/: one queryOptions factory and the read hook views use, per resource.`,
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
                'A query key is built in features/<domain>/queries/ only; elsewhere read it from the factory as options.queryKey.',
            });
        },
      };
    },
  },
  'web-commands-own-writes': hookBan({
    names: writeHooks,
    modules: queryModules,
    allowed: (path) => webPart(path) === 'command',
    message: (name) =>
      `\`${name}\` belongs to features/<domain>/commands/: one mutation and the command hook views use, per write.`,
  }),
  'web-cache-writes-in-commands': {
    create(context) {
      const path = webPath(context);
      const part = webPart(path);
      if (!runtimeWeb(path) || part === 'command' || part === 'live') return {};
      return {
        CallExpression(node) {
          const name = methodName(node.callee);
          if (name !== undefined && cacheWrites.has(name))
            context.report({
              node,
              message: `\`${name}\` writes the Query cache, which only a command in features/<domain>/commands/ or the feature live.ts does; everyone else reads it.`,
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
  'web-views-no-controlled-open': viewRule((context) => ({
    JSXAttribute(node) {
      if (
        node.name.type === 'JSXIdentifier' &&
        (node.name.name === 'open' || node.name.name === 'onOpenChange')
      )
        context.report({
          node,
          message:
            'An overlay opens through its Base UI handle from the feature overlays.ts, not a controlled open prop; the handle is the state.',
        });
    },
  })),
  'web-api-owns-request': {
    create(context) {
      const path = webPath(context);
      const part = webPart(path);
      if (!runtimeWeb(path) || part === 'api' || part === 'web-shared')
        return {};
      const check = (node) => {
        const specifier = sourceOf(node);
        if (specifier === undefined) return;
        if (localTarget(path, specifier) === 'shared/api/request')
          context.report({
            node,
            message:
              'The shared request function is called by the feature api.ts only; queries and commands call api.ts, so every request for a domain has one home.',
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
      const inside = path.slice(webSource.length);
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
                'Network requests belong in shared/api; a feature reaches them through its api.ts.',
            });
        },
        NewExpression(node) {
          if (
            globalCallee(node.callee, new Set(['WebSocket', 'EventSource'])) &&
            !inside.startsWith('shared/live/')
          )
            context.report({
              node,
              message:
                'Live connections belong in shared/live; a feature hears them through its live.ts.',
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
                'A timer lives in features/<domain>/commands/ or the feature store.ts, where the work it delays is owned; a view never schedules.',
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
        'features/<domain>/rules/ holds pure functions: no React, no I/O, only sibling rules, config/limits.ts, contracts and date-fns.';
      const check = (node) => {
        const specifier = sourceOf(node);
        if (specifier === undefined) return;
        const target = localTarget(path, specifier);
        const sibling =
          specifier.startsWith('./') && !specifier.slice(2).includes('/');
        if (
          target === 'config/limits' ||
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
          'A view does not await: it calls a command hook and renders the command state; the async work lives in commands/.',
      });
    },
    ForOfStatement(node) {
      if (node.await)
        context.report({
          node,
          message:
            'A view does not await: it calls a command hook and renders the command state; the async work lives in commands/.',
        });
    },
  })),
  'web-views-no-try': viewRule((context) => ({
    TryStatement(node) {
      context.report({
        node,
        message:
          'A view does not catch: a failed command reports through its hook state and the route error view; recovery lives in commands/.',
      });
    },
  })),
  'web-views-no-command-loops': viewRule((context) => {
    const bodies = [];
    const message =
      'A view does not loop over a command: a write that spans many items is one command in commands/ that takes the list.';
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
            'A view reads data through the feature hooks in queries/, commands/ and store.ts, not through TanStack Query, Zustand or the query client directly.',
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
              'A view gets route data as props from its route, which reads loader data, params and search; the view stays reusable outside that route.',
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
            'A view calls feature hooks from queries/ and commands/, never the transport, the live socket or the feature api.ts.',
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
            'A view receives feature data; the contract is read and parsed in api.ts, queries/ and commands/.',
        });
    },
  })),
  'web-view-line-budget': viewRule((context) => ({
    Program(program) {
      if (context.sourceCode.lines.length > VIEW_LINE_BUDGET)
        context.report({
          node: program,
          message: `A view stays under ${VIEW_LINE_BUDGET} lines: split it into smaller views in the same views/ folder and move logic into rules/, queries/ or commands/.`,
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
                'An empty catch swallows the failure; let it reach the command state or the error view, or handle it by name.',
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
                'Forwarding generic props through another primitive duplicates shadcn; use its registry component and variants in the feature view.',
            });
        },
      };
    },
  },
  'web-browser-spec-no-mocks': {
    create(context) {
      if (webPart(webPath(context)) !== 'browser-spec') return {};
      const message =
        'Browser behaviour runs against the real isolated server; vi mocks, spies and stubs have no place in a browser case.';
      return {
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
      if (webPart(webPath(context)) !== 'browser-spec') return {};
      const message =
        'Every journey runs every time, once, and must pass at once; remove the skip, only, todo, fails or the options object that sets retry, repeats or a timeout. The runner alone repeats a new or changed journey.';
      return {
        MemberExpression(node) {
          if (
            testFunctions.has(rootName(node) ?? '') &&
            (node.computed ||
              (node.property.type === 'Identifier' &&
                skipMembers.has(node.property.name)))
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
  'web-journey-imports': journeyRule((context) => {
    const message =
      'A journey imports test and its fixtures from ../kit/, expect and describe from vitest, page and userEvent from vitest/browser, and @porcelain/contracts; the app is reached only through the kit, which opens it the way a user does.';
    const check = (node) => {
      const source = sourceOf(node);
      if (source === undefined) {
        context.report({ node, message });
        return;
      }
      if (source.startsWith('@porcelain/contracts/')) return;
      if (/^\.\.\/kit\/[a-z0-9-]+$/.test(source)) return;
      const names = journeyImports.get(source);
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
  'web-journey-asserts': journeyRule((context) => {
    const cases = [];
    const asserting = new Set();
    return {
      CallExpression(node) {
        const body = caseBody(node);
        if (body) cases.push({ node, body });
        if (retryingMatcher(node))
          asserting.add(enclosingFunction(context, node));
      },
      'Program:exit'() {
        for (const { node, body } of cases)
          if (!asserting.has(body))
            context.report({
              node,
              message:
                'Every journey case asserts in its own body what the user sees, with expect.element, or what the server kept, with expect.poll; a case without one proves only that nothing threw.',
            });
      },
    };
  }),
  'web-journey-retrying-assertions': journeyRule((context) => ({
    CallExpression(node) {
      const message =
        'A journey asserts with retrying expect.element for what the page shows and expect.poll over the kit for what the server kept; a synchronous expect reads one moment and races the app.';
      if (node.callee.type === 'Identifier' && node.callee.name === 'expect') {
        context.report({ node, message });
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
      if (
        expectCall(node) === undefined &&
        journeyLocatorReads.has(methodName(node.callee) ?? '')
      )
        context.report({
          node,
          message:
            'A journey finds elements by role, label or text, the way a user and assistive technology do; CSS selectors, test ids and element reads couple it to markup and read one moment.',
        });
    },
  })),
  'web-journey-no-waits': journeyRule((context) => {
    const message =
      'A journey never waits a fixed time; expect.element and expect.poll retry until the page or the server catches up and fail with what they last saw.';
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
