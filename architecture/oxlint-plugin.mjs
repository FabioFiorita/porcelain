import { replacesGlobal } from './spec-globals.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, nodeGlobalRoles } from './policy.ts';
import {
  webRules,
  browserSpecNoMocks,
  browserSpecNoSkips,
} from './web-rules.mjs';
import { mobileRules } from './mobile-rules.mjs';
import { nativeHttpRules } from './native-http-rules.mjs';
import { hollowTests, testSource } from './hollow-tests.mjs';
import { findVariable } from './scope.mjs';

const domainPackage = '(?:projects|changes|reviews|files|git-actions|access)';
const domainSource = new RegExp(
  `/packages/${domainPackage}/src/(?:services|rules|models|ports|errors)/`,
);
const domainModule = new RegExp(
  `^@porcelain/(?:${domainPackage}/(?:services|models)|kernel/models)$`,
);
const useCaseSource = /\/apps\/server\/src\/use-cases\//;
const useCaseValueModule = new RegExp(
  `^@porcelain/(?:${domainPackage}|kernel)/(?:rules|errors)$`,
);
const modelsSource =
  /\/(?:packages\/(?:access|changes|files|git-actions|projects|reviews|kernel)\/src\/(?:models|ports)|apps\/server\/src\/ports)\/.+\.ts$/;
const composeSource =
  /\/apps\/server\/src\/bootstrap\/(?:.+\/)?(?:compose-[^/]+|main)\.ts$/;
const typedPackageSource =
  /\/packages\/[^/]+\/src\/(?:services|rules|models|ports)\//;

const mcpSource = /\/apps\/server\/src\/http\/mcp\/.+\.ts$/;

const parseMethods = new Set([
  'parse',
  'parseAsync',
  'safeParse',
  'safeParseAsync',
  'decode',
  'spa',
  'decodeUnknownSync',
  'decodeUnknownResult',
  'decodeUnknownEffect',
  'decodeUnknownOption',
  'decodeSync',
  'decodeResult',
  'decodeEffect',
  'decodeOption',
]);
const trustedParsers = new Set(['JSON', 'Date', 'Number', 'URL']);

function normalizedFilename(filename) {
  return filename.replaceAll('\\', '/');
}

function operationRole(filename) {
  const path = normalizedFilename(filename);
  if (
    new RegExp(`/apps/server/src/use-cases/${domainPackage}/.+\\.ts$`).test(
      path,
    )
  )
    return 'UseCase';
  if (
    /\/packages\/[^/]+\/src\/services\/(?:[^/]+\/)*[^/]+-service\.ts$/.test(
      path,
    )
  )
    return 'Service';
  return undefined;
}

function memberName(callee) {
  if (callee.computed)
    return callee.property.type === 'Literal'
      ? callee.property.value
      : undefined;
  return callee.property.type === 'Identifier'
    ? callee.property.name
    : undefined;
}

function typeOnlyImport(node) {
  return (
    node.importKind === 'type' ||
    (node.specifiers.length > 0 &&
      node.specifiers.every(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind === 'type',
      ))
  );
}

function isPrivateMember(member) {
  return (
    member.accessibility === 'private' ||
    member.accessibility === 'protected' ||
    member.key?.type === 'PrivateIdentifier'
  );
}

const specSource = /\.spec\.ts$/;
const storeContractSource = /\/packages\/[^/]+\/spec\/contracts\/.+\.ts$/;

const interactionMatchers = new Set([
  'toHaveBeenCalled',
  'toHaveBeenCalledTimes',
  'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith',
  'toHaveBeenNthCalledWith',
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toMatchFileSnapshot',
  'toThrowErrorMatchingSnapshot',
  'toThrowErrorMatchingInlineSnapshot',
]);
const testFunctions = new Set(['describe', 'suite', 'it', 'test']);
const caseFunctions = new Set(['it', 'test']);
const skippingModifiers = new Set([
  'skip',
  'only',
  'todo',
  'skipIf',
  'runIf',
  'fails',
]);
const loopTypes = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const repositoryRoot = normalizedFilename(
  fileURLToPath(new URL('..', import.meta.url)),
);
const nodeBuiltins = new Set(
  builtinModules.map((name) => name.replace(/^node:/, '')),
);
const aliasedParseMethods = new Set([
  ...parseMethods,
  'decodeAsync',
  'safeDecode',
  'safeDecodeAsync',
]);
const spyMatcher = /^toHave(?:BeenCalled|(?:Last|Nth)?(?:Returned|Resolved))/;
const nodeGlobals = new Set([
  'Buffer',
  'process',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
  'fetch',
  'global',
  'globalThis',
  'NodeJS',
  'crypto',
  'performance',
  'console',
  'queueMicrotask',
]);

const pureConstructors = new Set(['Map', 'Set', 'RegExp']);
const pureCrypto = new Set(['createHash', 'timingSafeEqual']);

const recordingFake = /^Recording[A-Z]/;
const mutatingMethods = new Set([
  'set',
  'add',
  'delete',
  'clear',
  'push',
  'unshift',
  'pop',
  'shift',
  'splice',
  'forEach',
  'assign',
]);
const gatingMethods = new Set(['filter', 'find', 'findLast', 'some', 'every']);
const serverCode = /^(?:apps\/server|packages\/[^/]+)\//;
const packageCode = /^packages\/([^/]+)\/(?:src|spec)\//;
const nodeGlobalScope =
  /^(?:packages\/[^/]+\/src|apps\/server\/src\/(?:use-cases|ports))\//;
const serverSource = /^(?:packages\/[^/]+|apps\/server)\/src\//;
const childProcessModules = new Set(['node:child_process', 'child_process']);
const blockingChildProcess = new Set(['execFileSync', 'execSync', 'spawnSync']);

const ruleFile = /^packages\/[^/]+\/src\/rules\//;
const portFile = /^packages\/([^/]+)\/src\/ports\//;
const anyPortFile = /^(?:packages\/[^/]+|apps\/server)\/src\/ports\//;
const runtimeFile = /^apps\/server\/src\/runtime\//;
const infrastructureInterfaceFile =
  /^packages\/(?:git|agents|process)\/src\/(?:.+\/)?interfaces\/[^/]+\.ts$/;
const serverAppFile = /^apps\/server\/src\//;
const timerGlobals = new Set(['setTimeout', 'setInterval', 'setImmediate']);
const timerModule = /^(?:node:)?timers(?:\/promises)?$/;

const fixtureFile = /^packages\/[^/]+\/spec\/fixtures\//;
const fixtureModules = new Set(['node:fs', 'node:path', 'node:url']);
const captureFile = /^packages\/[^/]+\/spec\/fixtures\/capture\.ts$/;
const captureModules = new Set([
  'node:child_process',
  'node:fs',
  'node:os',
  'node:path',
  'node:url',
]);
const fixtureModelSource =
  /^(?:\.\.\/\.\.\/src\/models\/[a-z0-9-]+\.ts|@porcelain\/kernel\/models)$/;

const rootScriptFile = /^scripts\/[^/]+\.ts$/;
const evaluatingFile =
  /^(?:scripts\/|\.agents\/skills\/|apps\/[^/]+\/spec\/|packages\/[^/]+\/spec\/)|\.spec\.tsx?$/;
const evaluationMethods = new Set([
  'evaluate',
  'evaluateHandle',
  'waitForFunction',
]);

const useCaseFile = /^apps\/server\/src\/use-cases\/.+\.ts$/;
const adapterFile = /^apps\/server\/src\/adapters\//;
const fakeFile = /^(?:packages\/[^/]+|apps\/server)\/spec\/fakes\//;
const clockFile =
  /^(?:packages\/[^/]+\/src\/rules|packages\/client\/src\/features\/[^/]+\/rules|apps\/server\/src\/adapters)\//;
const indexFile = /^packages\/[^/]+\/src\/(?:.+\/)?index\.ts$/;

function repositoryPath(context) {
  const path = normalizedFilename(context.filename);
  return path.startsWith(repositoryRoot)
    ? path.slice(repositoryRoot.length)
    : path;
}

function staticString(node, context, depth = 0) {
  if (!node || depth > 8) return undefined;
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'ParenthesizedExpression'
  )
    return staticString(node.expression, context, depth + 1);
  if (node.type === 'Literal')
    return typeof node.value === 'string' ? node.value : undefined;
  if (node.type === 'TemplateLiteral')
    return node.expressions.length === 0
      ? node.quasis.map((quasi) => quasi.value.cooked ?? '').join('')
      : undefined;
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left, context, depth + 1);
    const right = staticString(node.right, context, depth + 1);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (node.type !== 'Identifier') return undefined;
  const definition = findVariable(context.sourceCode.getScope(node), node.name)
    ?.defs[0];
  return definition?.node.type === 'VariableDeclarator' &&
    definition.parent?.kind === 'const'
    ? staticString(definition.node.init, context, depth + 1)
    : undefined;
}

function propertyName(node, context) {
  if (node.computed) return staticString(node.property ?? node.key, context);
  const key = node.property ?? node.key;
  if (key.type === 'Identifier') return key.name;
  return key.type === 'Literal' ? String(key.value) : undefined;
}

function gitCapabilityOf(path) {
  return /^packages\/git\/src\/([^/]+)\//.exec(path)?.[1];
}

function importsAnotherGitCapability(path, source) {
  const from = gitCapabilityOf(path);
  if (from === undefined) return false;
  const target = posix.join(posix.dirname(path), source);
  const to = /^packages\/git\/src\/([^/]+)\/index\.ts$/.exec(target)?.[1];
  return to !== undefined && to !== from;
}

function memberPath(node) {
  if (node?.type === 'Identifier') return [node.name];
  if (node?.type === 'ThisExpression') return ['this'];
  if (
    node?.type !== 'MemberExpression' ||
    node.computed ||
    node.property.type !== 'Identifier'
  )
    return undefined;
  const object = memberPath(node.object);
  return object && [...object, node.property.name];
}

function rootedAtThis(node) {
  let current = node;
  while (current?.type === 'MemberExpression') current = current.object;
  return current?.type === 'ThisExpression';
}

function hasEffect(node, visitorKeys) {
  if (!node || typeof node.type !== 'string') return false;
  if (
    node.type === 'AssignmentExpression' ||
    node.type === 'UpdateExpression' ||
    (node.type === 'UnaryExpression' && node.operator === 'delete')
  )
    return true;
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    mutatingMethods.has(memberName(node.callee) ?? '')
  )
    return true;
  return (visitorKeys[node.type] ?? []).some((key) => {
    const child = node[key];
    return Array.isArray(child)
      ? child.some((entry) => hasEffect(entry, visitorKeys))
      : hasEffect(child, visitorKeys);
  });
}

function receiverCalls(call) {
  const names = [];
  let current =
    call.callee.type === 'MemberExpression' ? call.callee.object : undefined;
  while (current) {
    if (current.type === 'CallExpression') {
      if (current.callee.type !== 'MemberExpression') break;
      names.push(memberName(current.callee));
      current = current.callee.object;
    } else if (current.type === 'MemberExpression') current = current.object;
    else if (current.type === 'ChainExpression') current = current.expression;
    else break;
  }
  return names;
}

function fromInput(node, context, depth = 0) {
  if (!node || depth > 8) return false;
  if (node.type === 'Identifier') {
    const variable = findVariable(context.sourceCode.getScope(node), node.name);
    const definition = variable?.defs[0];
    if (definition?.type === 'Parameter') return true;
    return (
      definition?.type === 'Variable' &&
      fromInput(definition.node.init, context, depth + 1)
    );
  }
  if (node.type === 'ThisExpression') return false;
  return (context.sourceCode.visitorKeys[node.type] ?? []).some((key) => {
    const child = node[key];
    return Array.isArray(child)
      ? child.some((entry) => fromInput(entry, context, depth + 1))
      : fromInput(child, context, depth + 1);
  });
}

function globalReferences(context, program, names) {
  let scope = context.sourceCode.getScope(program);
  while (scope.upper) scope = scope.upper;
  const builtin = [...names].flatMap(
    (name) => scope.set.get(name)?.references ?? [],
  );
  return [...scope.through, ...builtin]
    .filter((reference) => names.has(reference.identifier.name))
    .map((reference) => reference.identifier);
}

const pureGlobals = new Set(['Date', 'Math', 'Reflect', 'Intl']);

function calledMember(identifier, context) {
  const member = identifier.parent;
  if (member?.type !== 'MemberExpression' || member.object !== identifier)
    return undefined;
  const call = member.parent;
  return call?.type === 'CallExpression' && call.callee === member
    ? propertyName(member, context)
    : undefined;
}

function impureGlobalUse(identifier, context) {
  const name = identifier.name;
  if (name === 'Reflect')
    return 'A rule never reaches through Reflect; call the function it needs by name, because the same inputs must yield the same result on every machine.';
  if (name === 'Intl')
    return 'A rule is deterministic: Intl answers from the machine locale and time zone; the caller passes formatted text or the rule compares plain values, because the same inputs must yield the same result on every machine.';
  const member = calledMember(identifier, context);
  if (name === 'Math')
    return member === undefined || member === 'random'
      ? 'A rule is deterministic: call Math functions by name, never Math.random or an alias of Math, because the same inputs must yield the same result on every machine.'
      : undefined;
  const parent = identifier.parent;
  if (
    parent?.type === 'NewExpression' &&
    parent.callee === identifier &&
    parent.arguments.length === 1 &&
    parent.arguments[0].type !== 'SpreadElement'
  )
    return undefined;
  return member === 'parse'
    ? undefined
    : 'A rule takes the current time as an ISO string from its caller; it uses Date only as Date.parse(text) or new Date(instant), because the same inputs must yield the same result on every machine.';
}

function within(node, container) {
  return (
    node.range[0] >= container.range[0] && node.range[1] <= container.range[1]
  );
}

function nodesOf(node, visitorKeys, accept) {
  if (!node || typeof node.type !== 'string') return [];
  const found = accept(node) ? [node] : [];
  for (const key of visitorKeys[node.type] ?? []) {
    const child = node[key];
    for (const entry of Array.isArray(child) ? child : [child])
      found.push(...nodesOf(entry, visitorKeys, accept));
  }
  return found;
}

const laneCallbackIndexes = {
  Lanes: new Map([
    ['run', [2]],
    ['commit', [1]],
    ['transaction', [1, 2]],
    ['runConsistent', [2]],
    ['background', [1]],
    ['finish', [1]],
  ]),
  WorktreeAccess: new Map([
    ['read', [1]],
    ['write', [1]],
    ['reviews', [2]],
    ['transaction', [1, 2]],
    ['background', [1]],
  ]),
};

function importedBinding(node, context, seen = new Set()) {
  if (!node) return undefined;
  if (node.type === 'MemberExpression' || node.type === 'TSQualifiedName') {
    const owner = importedBinding(node.object ?? node.left, context, seen);
    return owner?.name === '*'
      ? { source: owner.source, name: node.right?.name ?? memberName(node) }
      : undefined;
  }
  if (node.type !== 'Identifier') return undefined;
  const variable = findVariable(context.sourceCode.getScope(node), node.name);
  if (!variable || seen.has(variable)) return undefined;
  const definition = variable.defs[0];
  if (definition?.type === 'ImportBinding')
    return {
      source: definition.parent.source.value,
      name:
        definition.node.type === 'ImportNamespaceSpecifier'
          ? '*'
          : definition.node.imported?.name,
    };
  return definition?.type === 'Variable' &&
    definition.parent.kind === 'const' &&
    definition.node.id.type === 'Identifier'
    ? importedBinding(
        definition.node.init,
        context,
        new Set([...seen, variable]),
      )
    : undefined;
}

function yieldedCapability(node, context, seen = new Set()) {
  if (node?.type !== 'Identifier') return undefined;
  const variable = findVariable(context.sourceCode.getScope(node), node.name);
  if (!variable || seen.has(variable)) return undefined;
  const definition = variable.defs[0];
  if (
    definition?.type !== 'Variable' ||
    definition.parent.kind !== 'const' ||
    definition.node.id.type !== 'Identifier'
  )
    return undefined;
  const value = definition.node.init;
  return value?.type === 'YieldExpression' && value.delegate
    ? importedBinding(value.argument, context)
    : yieldedCapability(value, context, new Set([...seen, variable]));
}

function laneOwner(node, context) {
  if (node.callee?.type !== 'MemberExpression') return undefined;
  const owner = yieldedCapability(node.callee.object, context);
  if (
    owner?.name === 'WorktreeAccess' &&
    /(?:^|\/)runtime\/worktree-access\.ts$/.test(owner.source)
  )
    return 'WorktreeAccess';
  return owner?.name === 'Lanes' &&
    /(?:^|\/)runtime\/lanes\.ts$/.test(owner.source)
    ? 'Lanes'
    : undefined;
}

function localFunction(node, context, seen = new Set()) {
  if (isFunction(node) || node?.type === 'FunctionDeclaration') return node;
  if (node?.type === 'Identifier') {
    const variable = findVariable(context.sourceCode.getScope(node), node.name);
    if (!variable || seen.has(variable)) return undefined;
    const definition = variable.defs[0];
    if (definition?.type === 'FunctionName') return definition.node;
    if (definition?.type === 'Variable' && definition.parent.kind === 'const')
      return localFunction(
        definition.node.init,
        context,
        new Set([...seen, variable]),
      );
  }
  if (node?.type !== 'CallExpression') return undefined;
  const factory =
    node.callee.type === 'CallExpression' ? node.callee.callee : node.callee;
  if (factory.type !== 'MemberExpression') return undefined;
  const owner = importedBinding(factory.object, context);
  return owner?.source === 'effect' &&
    owner.name === 'Effect' &&
    ['fn', 'fnUntraced'].includes(memberName(factory))
    ? node
    : undefined;
}

function takesLane(node, context) {
  return (
    node?.type === 'CallExpression' &&
    laneCallbackIndexes[laneOwner(node, context)]?.has(memberName(node.callee))
  );
}

function laneCallbacks(node, context) {
  if (node?.type !== 'CallExpression') return [];
  const owner = laneOwner(node, context);
  if (!owner) return [];
  return (laneCallbackIndexes[owner]?.get(memberName(node.callee)) ?? [])
    .map((index) => localFunction(node.arguments[index], context))
    .filter(Boolean);
}

function independentlyScheduled(node, context) {
  if (node?.type !== 'CallExpression' || !laneOwner(node, context))
    return false;
  return ['background', 'start'].includes(memberName(node.callee));
}

function callsInWork(node, context, seen = new Set(), invoked = false) {
  if (!node || seen.has(node)) return [];
  if (isFunction(node) || node.type === 'FunctionDeclaration')
    return invoked ? callsInWork(node.body, context, seen) : [];
  if (invoked) {
    const callback = localFunction(node, context);
    if (callback && callback !== node)
      return callsInWork(callback, context, seen, true);
  }
  seen.add(node);
  if (node.type === 'VariableDeclarator' && localFunction(node.init, context))
    return [];
  const calls = node.type === 'CallExpression' ? [node] : [];
  if (independentlyScheduled(node, context)) return calls;
  if (node.type === 'CallExpression') {
    const helper = localFunction(node.callee, context);
    if (helper) calls.push(...callsInWork(helper, context, seen, true));
    for (const argument of node.arguments) {
      const callback = localFunction(argument, context);
      if (callback || argument.type === 'ObjectExpression')
        calls.push(...callsInWork(callback ?? argument, context, seen, true));
    }
  }
  for (const key of context.sourceCode.visitorKeys[node.type] ?? []) {
    const child = node[key];
    for (const entry of Array.isArray(child) ? child : [child])
      if (
        entry?.type !== 'FunctionDeclaration' &&
        entry?.type !== 'ClassDeclaration'
      )
        calls.push(
          ...callsInWork(
            entry,
            context,
            seen,
            invoked &&
              (['ObjectExpression', 'ArrayExpression'].includes(node.type) ||
                (node.type === 'Property' && key === 'value')),
          ),
        );
  }
  return calls;
}

const laneHolderType =
  /(?:Store|Reader|Runner|Writer|Source|Service|UseCasePort)$/;

function isFunction(node) {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression'
  );
}

function moduleSource(node) {
  const source = node.source;
  if (source?.type === 'Literal' && typeof source.value === 'string')
    return source.value;
  return undefined;
}

function moduleVisitors(check) {
  return {
    ImportDeclaration: check,
    ImportExpression: check,
    ExportAllDeclaration: check,
    ExportNamedDeclaration(node) {
      if (node.source) check(node);
    },
  };
}

function isSpec(context) {
  const path = normalizedFilename(context.filename);
  return (
    specSource.test(path) ||
    storeContractSource.test(path) ||
    /packages\/client\/spec\/integration\/[a-z]+(?:-[a-z]+)*\.integration\.ts$/.test(
      path,
    )
  );
}

function browserSpec(context) {
  return /\/apps\/(?:web\/spec\/(?:integration\/.+\.test\.tsx|e2e\/.+\.e2e\.ts)|desktop\/spec\/e2e\/.+\.e2e\.ts)$/.test(
    normalizedFilename(context.filename),
  );
}

function antiFlakeSpec(context) {
  return (
    isSpec(context) ||
    browserSpec(context) ||
    /\/apps\/server\/spec\/integration\/.+\.integration\.ts$/.test(
      normalizedFilename(context.filename),
    )
  );
}

const timedExternalProcesses = new Set([
  'apps/mobile/spec/kit/metro.ts',
  'apps/mobile/spec/kit/simulator.ts',
  'apps/server/spec/fakes/scripted-service-update-runner.ts',
]);

function timedTest(context) {
  const path = repositoryPath(context);
  return (
    (/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path) ||
      /(?:^|\/)spec\//.test(path)) &&
    !timedExternalProcesses.has(path)
  );
}

function timingPath(node, context) {
  if (node?.type === 'CallExpression') return timingPath(node.callee, context);
  if (node?.type === 'MemberExpression') {
    const owner = timingPath(node.object, context);
    const name = memberName(node);
    return owner && name !== undefined ? `${owner}.${name}` : undefined;
  }
  if (node?.type !== 'Identifier') return undefined;
  const variable = findVariable(context.sourceCode.getScope(node), node.name);
  const definition = variable?.defs[0];
  if (definition?.type === 'ImportBinding') {
    if (
      typeOnlyImport(definition.parent) ||
      definition.node.importKind === 'type'
    )
      return undefined;
    const source = definition.parent.source.value;
    const name = definition.node.imported?.name;
    if (source === '@effect/vitest')
      return definition.node.type === 'ImportNamespaceSpecifier'
        ? 'effect-test'
        : `effect-test.${name}`;
    if (source === 'vitest')
      return definition.node.type === 'ImportNamespaceSpecifier'
        ? 'vitest'
        : `vitest.${name === 'vitest' ? 'vi' : name}`;
    if (source === 'effect' || source === 'effect/testing') return name;
    if (source === 'effect/Effect') return 'Effect';
    if (source === 'effect/testing/TestClock') return 'TestClock';
  }
  if (definition?.type === 'Parameter') {
    const callback = definition.node;
    const sites = callbackSites(callback, context);
    if (
      callback.params[0]?.type === 'Identifier' &&
      callback.params[0].name === node.name &&
      !variable.references.some((reference) => reference.isWrite()) &&
      sites.length > 0 &&
      sites.every((site) => {
        const layer = site.parent.callee;
        if (
          layer?.type !== 'CallExpression' ||
          !/^effect-test\.(?:(?:it|test)\.)?layer$/.test(
            timingPath(layer.callee, context) ?? '',
          )
        )
          return false;
        const options = layer.arguments[1];
        return (
          options === undefined ||
          (options.type === 'ObjectExpression' &&
            options.properties.every(
              (property) =>
                property.type === 'Property' &&
                propertyName(property, context) !== undefined &&
                (propertyName(property, context) !== 'excludeTestServices' ||
                  (property.value.type === 'Literal' &&
                    property.value.value === false)),
            ))
        );
      })
    )
      return 'effect-test.it';
  }
  if (definition) return `local.${node.name}`;
  if (['vi', 'vitest'].includes(node.name)) return 'vitest.vi';
  if (node.name === 'TestClock') return undefined;
  return node.name;
}

function callbackSites(callback, context) {
  const parent = callback.parent;
  if (parent?.type === 'CallExpression' && parent.arguments.includes(callback))
    return [callback];
  const id =
    callback.type === 'FunctionDeclaration'
      ? callback.id
      : parent?.type === 'VariableDeclarator' &&
          parent.init === callback &&
          parent.parent.kind === 'const'
        ? parent.id
        : undefined;
  if (id?.type !== 'Identifier') return [];
  const references =
    findVariable(context.sourceCode.getScope(callback), id.name)
      ?.references.filter((reference) => reference.isRead())
      .map((reference) => reference.identifier) ?? [];
  return references.every(
    (reference) =>
      reference.parent?.type === 'CallExpression' &&
      (reference.parent.arguments.includes(reference) ||
        reference.parent.callee === reference) &&
      !(
        reference.range[0] >= callback.range[0] &&
        reference.range[1] <= callback.range[1]
      ),
  )
    ? references
    : [];
}

const effectRuntime =
  /^Effect\.run|\.run(?:Promise(?:Exit)?|Sync(?:Exit)?|Fork|Callback)$/;

function testClockSleep(node, context, seen = new Set()) {
  if (seen.has(node)) return false;
  seen.add(node);
  for (let current = node.parent; current; current = current.parent) {
    if (
      current.id?.type === 'Identifier' &&
      ((current.type === 'VariableDeclarator' &&
        !['YieldExpression', 'AwaitExpression'].includes(current.init?.type) &&
        current.parent.kind === 'const') ||
        current.type === 'FunctionDeclaration')
    ) {
      const references =
        findVariable(
          context.sourceCode.getScope(current),
          current.id.name,
        )?.references.filter((reference) => reference.isRead()) ?? [];
      return (
        references.length > 0 &&
        references.every((reference) =>
          testClockSleep(reference.identifier, context, new Set(seen)),
        )
      );
    }
    if (current.type !== 'CallExpression') continue;
    const path = timingPath(current.callee, context);
    if (path === 'TestClock.withLive') return false;
    if (path?.endsWith('.pipe')) {
      for (const argument of current.arguments) {
        if (timingPath(argument, context) === 'TestClock.withLive')
          return false;
        if (effectRuntime.test(timingPath(argument, context) ?? ''))
          return false;
        if (
          argument.type === 'CallExpression' &&
          timingPath(argument.callee, context) === 'Effect.provide' &&
          argument.arguments.some(
            (layer) =>
              layer.type === 'CallExpression' &&
              timingPath(layer.callee, context) === 'TestClock.layer',
          )
        )
          return true;
      }
    }
    if (
      path === 'Effect.provide' &&
      current.arguments.length > 1 &&
      current.arguments
        .slice(1)
        .some(
          (layer) =>
            layer.type === 'CallExpression' &&
            timingPath(layer.callee, context) === 'TestClock.layer',
        )
    )
      return true;
    if (effectRuntime.test(path ?? '')) return false;
    if (/^effect-test\.(?:it|test)\.effect(?:\.|$)/.test(path ?? ''))
      return current.arguments.some(
        (argument) =>
          (['ArrowFunctionExpression', 'FunctionExpression'].includes(
            argument.type,
          ) ||
            argument === node) &&
          argument.range[0] <= node.range[0] &&
          argument.range[1] >= node.range[1],
      );
  }
  return false;
}

function fakeClock(node, context, clock, sites = new Map()) {
  const scopes = [];
  const visited = new Set();
  for (let current = node.parent; current; current = current.parent) {
    if (visited.has(current)) return false;
    visited.add(current);
    const callback = [
      'ArrowFunctionExpression',
      'FunctionExpression',
      'FunctionDeclaration',
    ].includes(current.type);
    if (callback && !sites.has(current)) {
      const named = callbackSites(current, context);
      if (named.length > 0 && named[0] !== current)
        return named.every((site) =>
          fakeClock(node, context, clock, new Map(sites).set(current, site)),
        );
    }
    if (
      current.type === 'Program' ||
      (current.type === 'BlockStatement' &&
        ![
          'ArrowFunctionExpression',
          'FunctionExpression',
          'FunctionDeclaration',
        ].includes(current.parent?.type)) ||
      callback
    )
      scopes.unshift(current);
    if (sites.has(current)) current = sites.get(current);
  }
  const site = (scope) => sites.get(scope) ?? scope;
  let fake = false;
  const apply = (call) => {
    if (call?.type !== 'CallExpression') return;
    const path = timingPath(call.callee, context);
    if (path === 'vitest.vi.useRealTimers') {
      fake = false;
    }
    if (path !== 'vitest.vi.useFakeTimers') return;
    const options = call.arguments[0];
    if (
      options?.type === 'ObjectExpression' &&
      options.properties.some(
        (property) =>
          property.type === 'SpreadElement' ||
          propertyName(property, context) === undefined,
      )
    ) {
      fake = false;
      return;
    }
    const toFake =
      options?.type === 'ObjectExpression'
        ? options.properties.findLast(
            (property) => propertyName(property, context) === 'toFake',
          )?.value
        : undefined;
    fake = options === undefined || options.type === 'ObjectExpression';
    if (toFake)
      fake =
        toFake.type === 'ArrayExpression' &&
        (toFake.elements.length === 0 ||
          toFake.elements.some((element) => element?.value === clock));
    const toNotFake =
      options?.type === 'ObjectExpression'
        ? options.properties.findLast(
            (property) => propertyName(property, context) === 'toNotFake',
          )?.value
        : undefined;
    if (toNotFake)
      fake =
        fake &&
        toNotFake.type === 'ArrayExpression' &&
        toNotFake.elements.every((element) => element?.type === 'Literal') &&
        !toNotFake.elements.some((element) => element?.value === clock);
  };
  const controlsTimers = (part, functions = false) => {
    if (!part || typeof part !== 'object') return false;
    if (
      !functions &&
      [
        'ArrowFunctionExpression',
        'FunctionExpression',
        'FunctionDeclaration',
      ].includes(part.type)
    )
      return false;
    if (
      part.type === 'CallExpression' &&
      /^vitest\.vi\.use(?:Fake|Real)Timers$/.test(
        timingPath(part.callee, context) ?? '',
      )
    )
      return true;
    return Object.entries(part).some(
      ([key, value]) =>
        key !== 'parent' &&
        (Array.isArray(value)
          ? value.some((child) => controlsTimers(child, functions))
          : controlsTimers(value, functions)),
    );
  };
  const callbacks = (call) =>
    call.arguments.filter((argument) =>
      ['ArrowFunctionExpression', 'FunctionExpression'].includes(argument.type),
    );
  const applyBody = (body, before, after = -Infinity) => {
    if (body?.type !== 'BlockStatement' && body?.type !== 'Program') {
      if (body?.range[0] < before && body.range[0] >= after) apply(body);
      return;
    }
    for (const statement of body.body) {
      if (statement.range[1] > before || statement.range[0] < after) continue;
      const call =
        statement.type === 'ExpressionStatement'
          ? statement.expression
          : undefined;
      if (
        call?.type === 'CallExpression' &&
        /^vitest\.vi\.use(?:Fake|Real)Timers$/.test(
          timingPath(call.callee, context) ?? '',
        )
      )
        apply(call);
      else if (
        call?.type === 'CallExpression' &&
        /^(?:(?:vitest|effect-test)\.)?describe(?:\.|$)/.test(
          timingPath(call.callee, context) ?? '',
        )
      ) {
        const suites = callbacks(call);
        if (suites.length === 0) fake = false;
        for (const suite of suites) applyBody(suite.body, Infinity);
      } else if (controlsTimers(statement)) {
        fake = false;
      }
    }
  };
  for (let index = 0; index < scopes.length; index++) {
    const scope = scopes[index];
    const body = ['Program', 'BlockStatement'].includes(scope.type)
      ? scope
      : scope.body;
    const next = scopes[index + 1];
    applyBody(body, (site(next) ?? node).range[0]);
    const registration = site(next)?.parent;
    if (
      registration?.type !== 'CallExpression' ||
      !/^(?:(?:vitest|effect-test)\.)?(?:it|test)(?:\.|$)/.test(
        timingPath(registration.callee, context) ?? '',
      )
    )
      continue;
    const suites = scopes.slice(0, index + 1);
    const bodyOf = (suite) =>
      ['Program', 'BlockStatement'].includes(suite.type) ? suite : suite.body;
    for (let suiteIndex = suites.length - 1; suiteIndex >= 0; suiteIndex--)
      applyBody(
        bodyOf(suites[suiteIndex]),
        Infinity,
        site(suites[suiteIndex + 1] ?? next).range[1],
      );
    const applyHooks = (suite, hook) => {
      const statements = bodyOf(suite)?.body ?? [];
      for (const statement of hook === 'afterEach'
        ? statements.toReversed()
        : statements) {
        const call = statement.expression;
        if (
          call?.type === 'CallExpression' &&
          [hook, `vitest.${hook}`, `effect-test.${hook}`].includes(
            timingPath(call.callee, context),
          )
        ) {
          const hooks = callbacks(call);
          if (hooks.length === 0) fake = false;
          for (const callback of hooks) applyBody(callback.body, Infinity);
        }
      }
    };
    for (let suiteIndex = 0; suiteIndex < suites.length; suiteIndex++) {
      const suite = suites[suiteIndex];
      applyHooks(suite, 'beforeAll');
      const cutoff = site(suites[suiteIndex + 1] ?? next).range[0];
      const previous = (bodyOf(suite)?.body ?? [])
        .map((statement) => statement.expression)
        .filter(
          (call) =>
            call?.type === 'CallExpression' &&
            call.range[1] <= cutoff &&
            /^(?:(?:vitest|effect-test)\.)?(?:it|test|describe)(?:\.|$)/.test(
              timingPath(call.callee, context) ?? '',
            ),
        );
      if (previous.length === 0) continue;
      if (
        previous.some((call) =>
          callbacks(call).some((callback) =>
            controlsTimers(callback.body, true),
          ),
        )
      )
        fake = false;
      for (const owner of suites.slice(0, suiteIndex + 1).toReversed())
        applyHooks(owner, 'afterEach');
    }
    for (const suite of suites) applyHooks(suite, 'beforeEach');
  }
  return fake;
}

function browserWaits(context) {
  const original = webRules['web-journey-no-waits'].create(context);
  if (!browserSpec(context)) return original;
  const message =
    'Await a locator assertion or a semantic event, because timers, renderer frames and animation completion race host load and do not prove the promised state.';
  const waits = new Set([
    'setTimeout',
    'setInterval',
    'requestAnimationFrame',
    'requestIdleCallback',
    'waitForTimeout',
    'sleep',
    'delay',
  ]);
  const transitions = new Set(['transitionend', 'animationend']);
  const timerImports = new Set();
  const timerNamespaces = new Set();
  return {
    ...original,
    ImportDeclaration(node) {
      if (
        !typeOnlyImport(node) &&
        /^(?:node:)?timers(?:\/promises)?$/.test(node.source.value)
      ) {
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier')
            timerNamespaces.add(specifier.local.name);
          else if (
            ['setTimeout', 'setInterval', 'setImmediate'].includes(
              specifier.imported.name,
            )
          )
            timerImports.add(specifier.local.name);
        }
      }
    },
    CallExpression(node) {
      const callee = node.callee;
      if (
        (callee.type === 'Identifier' && timerImports.has(callee.name)) ||
        (callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          timerNamespaces.has(callee.object.name) &&
          ['setTimeout', 'setInterval', 'setImmediate'].includes(
            memberName(callee),
          ))
      ) {
        context.report({ node, message });
        return;
      }
      const name =
        callee.type === 'Identifier'
          ? callee.name
          : callee.type === 'MemberExpression'
            ? memberName(callee)
            : undefined;
      if (
        waits.has(name) ||
        (callee.type === 'MemberExpression' &&
          callee.computed &&
          name === undefined &&
          ['page', 'window', 'globalThis', 'self'].includes(
            chainRoot(callee),
          )) ||
        (['addEventListener', 'once', 'on'].includes(name) &&
          transitions.has(node.arguments[0]?.value))
      ) {
        if (
          ![
            'setTimeout',
            'setInterval',
            'requestAnimationFrame',
            'requestIdleCallback',
          ].includes(name) ||
          callee.computed ||
          normalizedFilename(context.filename).includes('/apps/desktop/')
        )
          context.report({ node, message });
        return;
      }
      original.CallExpression?.(node);
    },
    NewExpression(node) {
      if (!normalizedFilename(context.filename).includes('/apps/desktop/'))
        return;
      if (node.callee.name !== 'Promise') return;
      const executor = node.arguments[0];
      const name =
        executor?.type === 'Identifier'
          ? executor.name
          : executor?.type === 'MemberExpression'
            ? memberName(executor)
            : undefined;
      if (waits.has(name)) context.report({ node, message });
    },
  };
}

function chainRoot(node) {
  let current = node;
  while (
    current.type === 'MemberExpression' ||
    current.type === 'CallExpression'
  )
    current =
      current.type === 'MemberExpression' ? current.object : current.callee;
  return current.type === 'Identifier' ? current.name : undefined;
}

function caseCall(node, context) {
  const name = chainRoot(node.callee);
  if (!name) return false;
  const definition = findVariable(context.sourceCode.getScope(node), name)
    ?.defs[0];
  if (!definition) return caseFunctions.has(name);
  return (
    definition.type === 'ImportBinding' &&
    [
      'vitest',
      '@effect/vitest',
      '@playwright/test',
      'playwright/test',
    ].includes(definition.parent.source.value) &&
    caseFunctions.has(definition.node.imported?.name ?? name)
  );
}

function nativeMember(node, context, namespace, names) {
  if (
    node?.type !== 'CallExpression' ||
    node.callee.type !== 'MemberExpression' ||
    node.callee.object.type !== 'Identifier' ||
    !names.has(memberName(node.callee))
  )
    return false;
  const definition = findVariable(
    context.sourceCode.getScope(node),
    node.callee.object.name,
  )?.defs[0];
  return (
    definition?.type === 'ImportBinding' &&
    definition.parent.source.value === 'effect' &&
    definition.node.imported?.name === namespace
  );
}

function nativeSchemaValue(node, context, seen = new Set()) {
  if (!node) return false;
  if (node.type === 'Literal') return true;
  if (node.type === 'ArrayExpression')
    return node.elements.every((element) =>
      nativeSchemaValue(element, context, seen),
    );
  if (node.type === 'ObjectExpression')
    return node.properties.every((property) =>
      property.type === 'SpreadElement'
        ? nativeSchemaValue(property.argument, context, seen)
        : !property.computed &&
          !property.method &&
          property.kind === 'init' &&
          nativeSchemaValue(property.value, context, seen),
    );
  if (node.type === 'MemberExpression') {
    if (node.object.type === 'Identifier') {
      const definition = findVariable(
        context.sourceCode.getScope(node),
        node.object.name,
      )?.defs[0];
      if (
        definition?.type === 'ImportBinding' &&
        definition.parent.source.value === 'effect' &&
        definition.node.imported?.name === 'Schema'
      )
        return /^(?:String|Number|Int|Boolean|Undefined|Null|Never|Uint8Array)$/.test(
          memberName(node),
        );
    }
    return (
      memberName(node) === 'fields' &&
      nativeSchemaValue(node.object, context, seen)
    );
  }
  if (node.type === 'Identifier') {
    if (!/Schema$/.test(node.name) || seen.has(node.name)) return false;
    const definition = findVariable(
      context.sourceCode.getScope(node),
      node.name,
    )?.defs[0];
    if (definition?.type === 'ImportBinding')
      return (
        /^(?:@porcelain\/[^/]+\/models|\.\.?\/[^/]+\.ts)$/.test(
          definition.parent.source.value,
        ) && /Schema$/.test(definition.node.imported?.name ?? '')
      );
    if (definition?.type !== 'Variable' || definition.parent.kind !== 'const')
      return false;
    return nativeSchemaValue(
      definition.node.init,
      context,
      new Set([...seen, node.name]),
    );
  }
  return (
    (nativeMember(
      node,
      context,
      'Schema',
      new Set([
        'Struct',
        'Union',
        'Literal',
        'Array',
        'mutable',
        'mutableKey',
        'optional',
        'NullOr',
        'Literals',
        'Redacted',
        'Cause',
        'Defect',
      ]),
    ) ||
      nativeMember(node, context, 'Struct', new Set(['omit']))) &&
    node.arguments.every((argument) =>
      nativeSchemaValue(argument, context, seen),
    )
  );
}

function effectMember(node, context, names) {
  return nativeMember(node, context, 'Effect', names);
}

function capabilityOwner(context) {
  return /^(?:packages|apps)\/([^/]+)\/src\//.exec(
    repositoryPath(context),
  )?.[1];
}

function nativePortKey(node, context) {
  if (!/\/ports\//.test(normalizedFilename(context.filename))) return false;
  if (node.kind !== 'const' || node.declarations.length !== 1) return false;
  const { id, init } = node.declarations[0];
  if (
    id.type !== 'Identifier' ||
    !nativeMember(init, context, 'Context', new Set(['Service']))
  )
    return false;
  const [identifier] = init.typeArguments?.params ?? [];
  const key = `@porcelain/${capabilityOwner(context)}/${id.name}`;
  return (
    identifier?.type === 'TSLiteralType' &&
    identifier.literal.value === key &&
    init.arguments.length === 1 &&
    init.arguments[0].value === key
  );
}

function nativeOperation(node, context) {
  const base = node.superClass;
  const factory = base?.callee?.callee;
  const owner =
    factory?.type === 'MemberExpression'
      ? importedBinding(factory.object, context)
      : undefined;
  return base?.type === 'CallExpression' &&
    base.callee.type === 'CallExpression' &&
    owner?.source === 'effect' &&
    owner.name === 'Context' &&
    memberName(factory) === 'Service'
    ? base
    : undefined;
}

function nativeOperationProblem(node, context) {
  const base = nativeOperation(node, context);
  if (!base)
    return 'Declare a native Context.Service capability with a static Layer';
  const shape = base.callee.typeArguments?.params?.[1];
  const execute =
    shape?.type === 'TSTypeLiteral' && shape.members.length === 1
      ? shape.members[0]
      : undefined;
  if (
    execute?.type !== 'TSPropertySignature' ||
    execute.key.name !== 'execute' ||
    !execute.readonly ||
    execute.optional ||
    execute.typeAnnotation?.typeAnnotation.type !== 'TSFunctionType'
  )
    return 'Declare one readonly execute function in the capability shape';
  const layer = node.body.body.find(
    (member) =>
      member.type === 'PropertyDefinition' &&
      member.static &&
      member.readonly &&
      nativeMember(
        member.value,
        context,
        'Layer',
        new Set(['effect', 'sync', 'succeed']),
      ),
  );
  if (!layer) return 'Declare a static readonly Layer';
  if (node.body.body.some((member) => member.kind === 'constructor'))
    return 'Resolve dependencies through Layers instead of constructor injection';
  return undefined;
}

function executedEffectBody(call, context) {
  let current = call;
  while (current.parent) {
    const parent = current.parent;
    if (parent.type === 'YieldExpression' && parent.delegate) return true;
    if (
      parent.type === 'MemberExpression' &&
      parent.object === current &&
      memberName(parent) === 'pipe' &&
      parent.parent?.type === 'CallExpression'
    ) {
      current = parent.parent;
      continue;
    }
    if (
      parent.type === 'CallExpression' &&
      parent.arguments.includes(current)
    ) {
      if (effectMember(parent, context, new Set(['runSync']))) return true;
      if (
        effectMember(parent, context, new Set(['runPromise', 'runPromiseExit']))
      )
        return (
          ['AwaitExpression', 'ReturnStatement'].includes(
            parent.parent?.type,
          ) ||
          (parent.parent?.type === 'ArrowFunctionExpression' &&
            parent.parent.body === parent)
        );
      if (
        effectMember(
          parent,
          context,
          new Set(['scoped', 'provide', 'provideService']),
        )
      ) {
        current = parent;
        continue;
      }
    }
    const owner =
      parent.type === 'ReturnStatement'
        ? context.sourceCode.getAncestors(parent).findLast(isFunction)
        : parent.type === 'ArrowFunctionExpression' && parent.body === current
          ? parent
          : undefined;
    return (
      owner?.parent?.type === 'CallExpression' &&
      caseCall(owner.parent, context) &&
      owner.parent.callee.type === 'MemberExpression' &&
      ['effect', 'live', 'scoped'].includes(memberName(owner.parent.callee))
    );
  }
  return false;
}

const specExports = new Map();

function allowedSpecImport(filename, source) {
  const path = normalizedFilename(filename);
  const owner = (value) =>
    /\/(packages|apps)\/([^/]+)\//.exec(value)?.slice(1).join('/');
  if (source.startsWith('.')) {
    const target = posix.resolve(posix.dirname(path), source);
    return (
      owner(target) === owner(path) ||
      /\/spec\/(?:kit|fakes|fixtures|contracts)\//.test(target)
    );
  }
  if (!source.startsWith('@porcelain/')) return true;
  const [, name, entry] = /^@porcelain\/([^/]+)(?:\/(.*))?$/.exec(source) ?? [];
  if (!name) return false;
  if (!specExports.has(name)) {
    const manifest = ['packages', 'apps']
      .map((folder) => posix.join(repositoryRoot, folder, name, 'package.json'))
      .find(existsSync);
    specExports.set(
      name,
      manifest
        ? Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).exports ?? {})
        : [],
    );
  }
  const subpath = entry ? `./${entry}` : '.';
  return specExports
    .get(name)
    .some(
      (key) =>
        key === subpath ||
        (key.includes('*') &&
          subpath.startsWith(key.split('*')[0]) &&
          subpath.endsWith(key.split('*')[1])),
    );
}

const fakeName = /^(?:InMemory|Scripted|Fixed|Sequential|Recording)[A-Z]/;

const pascalCase = /^[A-Z][A-Za-z0-9]*$/;

const camelCase = /^[a-z][A-Za-z0-9]*$/;

const screamingCase = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

const portShapedScope = new RegExp(
  `^(?:apps/server/src/|packages/(?:${domainPackage}|kernel|git|agents|process)/src/)`,
);

function primitiveValue(node) {
  if (!node) return false;
  if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression')
    return primitiveValue(node.expression);
  if (node.type === 'Literal') return !node.regex && node.value !== null;
  if (node.type === 'TemplateLiteral')
    return node.expressions.every(primitiveValue);
  if (node.type === 'UnaryExpression') return primitiveValue(node.argument);
  if (node.type === 'BinaryExpression')
    return primitiveValue(node.left) && primitiveValue(node.right);
  return false;
}

export default {
  meta: { name: 'porcelain' },
  rules: {
    'hermes-array-methods': {
      create(context) {
        if (
          !/\/(?:packages\/client|apps\/mobile)\/src\//.test(
            normalizedFilename(context.filename),
          )
        )
          return {};
        return {
          MemberExpression(node) {
            if (
              ['toSorted', 'toReversed', 'toSpliced', 'with'].includes(
                memberName(node),
              )
            )
              context.report({
                node,
                message:
                  'Use a copied array with sort, reverse, splice or indexed assignment, because Hermes does not support Array.prototype.toSorted, toReversed, toSpliced or with.',
              });
          },
        };
      },
    },
    'writable-reads-what-it-sets': {
      create(context) {
        const visitorKeys = context.sourceCode.visitorKeys;
        const atomKey = (node) =>
          context.sourceCode.getText(
            node?.type === 'CallExpression' ? node.callee : node,
          );
        const mounting = new Set(['get', 'mount', 'result', 'subscribe']);
        const callsOn = (body, name, accept) =>
          nodesOf(
            body,
            visitorKeys,
            (entry) =>
              entry.type === 'CallExpression' &&
              entry.arguments.length > 0 &&
              accept(entry.callee, name),
          );
        return {
          CallExpression(node) {
            const [read, write] = node.arguments;
            const getter = read?.params?.[0];
            const setter = write?.params?.[0];
            if (
              node.callee.type !== 'MemberExpression' ||
              node.callee.object.type !== 'Identifier' ||
              node.callee.object.name !== 'Atom' ||
              memberName(node.callee) !== 'writable' ||
              !isFunction(read) ||
              !isFunction(write) ||
              setter?.type !== 'Identifier'
            )
              return;
            const kept = new Set(
              getter?.type === 'Identifier'
                ? callsOn(
                    read.body,
                    getter.name,
                    (callee, name) =>
                      (callee.type === 'Identifier' && callee.name === name) ||
                      (callee.type === 'MemberExpression' &&
                        callee.object.type === 'Identifier' &&
                        callee.object.name === name &&
                        mounting.has(memberName(callee))),
                  ).map((call) => atomKey(call.arguments[0]))
                : [],
            );
            for (const call of callsOn(
              write.body,
              setter.name,
              (callee, name) =>
                callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                callee.object.name === name &&
                memberName(callee) === 'set',
            ))
              if (!kept.has(atomKey(call.arguments[0])))
                context.report({
                  node: call,
                  message: `Read \`${atomKey(call.arguments[0])}\` with get in this writable's read function too, because the registry drops an atom nothing subscribes to on the next tick and interrupts the command this set started.`,
                });
          },
        };
      },
    },
    ...nativeHttpRules,
    ...webRules,
    'web-journey-no-waits': { create: browserWaits },
    ...mobileRules,
    'worktree-admission-owner': {
      create(context) {
        const path = repositoryPath(context);
        if (
          isSpec(context) ||
          path.startsWith('packages/effects/src/') ||
          path === 'apps/server/src/runtime/worktree-access.ts'
        )
          return {};
        const owned = new Set([
          'withReadLease',
          'withWriteLease',
          'WorktreeRead',
          'WorktreeWrite',
        ]);
        const check = (node) => {
          if (
            !/^@porcelain\/effects(?:\/worktree)?$/.test(
              moduleSource(node) ?? '',
            ) ||
            node.importKind === 'type' ||
            node.exportKind === 'type'
          )
            return;
          const invalid =
            node.type === 'ExportAllDeclaration' ||
            (node.specifiers ?? []).some(
              (specifier) =>
                specifier.importKind !== 'type' &&
                specifier.exportKind !== 'type' &&
                (specifier.type === 'ImportNamespaceSpecifier' ||
                  owned.has(specifier.imported?.name ?? specifier.local?.name)),
            );
          if (invalid)
            context.report({
              node,
              message:
                'Only WorktreeAccess grants or supplies worktree capabilities; import their types in operations and use the admitted IO ports, because providing a lease inside a feature bypasses identity checks, writer priority and lifetime ownership.',
            });
        };
        return {
          ImportDeclaration: check,
          ExportNamedDeclaration: check,
          ExportAllDeclaration: check,
        };
      },
    },
    'client-owns-shared-logic': {
      create(context) {
        const path = repositoryPath(context);
        if (
          isSpec(context) ||
          !/^(?:apps\/(?:web|mobile)\/src\/|packages\/client\/src\/)/.test(path)
        )
          return {};
        const appFeature = /^apps\/(?:web|mobile)\/src\/features\//.test(path);
        const appCode = path.startsWith('apps/');
        const checkSharedReexport = (node) => {
          if (!appCode) return;
          const indirect = node.specifiers?.some((specifier) => {
            const local = specifier.local?.name;
            if (!local) return false;
            const definition = findVariable(
              context.sourceCode.getScope(specifier),
              local,
            )?.defs[0];
            return (
              definition?.type === 'ImportBinding' &&
              /^@porcelain\/client(?:\/|$)/.test(definition.parent.source.value)
            );
          });
          if (
            indirect ||
            /^@porcelain\/client(?:\/|$)/.test(moduleSource(node) ?? '')
          )
            context.report({
              node,
              message:
                'Import the shared client owner directly and remove the obsolete forwarding file, because a second export path hides ownership and becomes a pattern for future agents.',
            });
        };
        const dataOwner =
          /\/(?:queries|commands)\/|\/store\.ts$|\/shared\/query\//.test(path);
        const keyOwner =
          path === 'packages/client/src/shared/api/query-keys.ts';
        const keyPrefixes = new Set([
          'review',
          'inventory',
          'environment',
          'access',
          'remote-status',
          'paired-access',
          'remote-access',
          'service-update',
          'project-folder',
          'commit-models',
          'desktop-app-update',
        ]);
        const report = (node, message) => context.report({ node, message });
        return {
          ExportNamedDeclaration: checkSharedReexport,
          ExportAllDeclaration: checkSharedReexport,
          ArrayExpression(node) {
            if (
              dataOwner &&
              !keyOwner &&
              node.elements.length > 1 &&
              keyPrefixes.has(node.elements[0]?.value)
            )
              report(
                node,
                'Use the shared client key builders, because cache reads and invalidations must identify the same resource in every app.',
              );
          },
          Property(node) {
            if (
              !keyOwner &&
              node.key.name === 'queryKey' &&
              node.value.type === 'ArrayExpression' &&
              !keyPrefixes.has(node.value.elements[0]?.value)
            )
              report(
                node.value,
                'Use the shared client key builders, because cache reads and invalidations must identify the same resource in every app.',
              );
          },
          CallExpression(node) {
            const callee = node.callee;
            if (
              dataOwner &&
              callee.type === 'MemberExpression' &&
              callee.object.name === 'Promise' &&
              callee.property.name === 'resolve' &&
              node.arguments.length === 0
            )
              report(
                node,
                'Use the shared client write queue, because dependent writes must stop after a failure and reject to their caller.',
              );
            if (
              /\/queries\//.test(path) &&
              callee.type === 'MemberExpression' &&
              callee.property.name === 'throwIfAborted'
            )
              report(
                node,
                'Use assertCurrentAnswer, because cancellation and stale answers need one guard and one explanation across clients.',
              );
          },
          IfStatement(node) {
            if (
              !appFeature ||
              !dataOwner ||
              node.test.type !== 'UnaryExpression' ||
              node.test.operator !== '!' ||
              node.test.argument.name !== 'connection'
            )
              return;
            const body =
              node.consequent.type === 'BlockStatement'
                ? node.consequent.body[0]
                : node.consequent;
            if (body?.type === 'ThrowStatement')
              report(
                node,
                'Receive a non-null connection from the connected boundary, because repeated feature guards hide which views can run disconnected.',
              );
          },
          Literal(node) {
            if (
              path !== 'packages/client/src/shared/api/stale-answer.ts' &&
              typeof node.value === 'string' &&
              /^The (?:file|review|comment|commit|connected) context changed\./.test(
                node.value,
              )
            )
              report(
                node,
                'Use assertCurrentAnswer, because cancellation and stale answers need one guard and one explanation across clients.',
              );
          },
        };
      },
    },
    'mcp-tool-handler': {
      create(context) {
        if (
          !mcpSource.test(normalizedFilename(context.filename)) ||
          isSpec(context)
        )
          return {};
        const handlers = [];
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (
              callee.type === 'MemberExpression' &&
              propertyName(callee, context) === 'registerTool'
            ) {
              context.report({
                node,
                message:
                  'Register MCP tools with the native ReviewToolkit, because the contract owns validation, results and handler completeness.',
              });
              return;
            }
            if (
              callee.type === 'MemberExpression' &&
              propertyName(callee, context) === 'toLayer'
            ) {
              const binding = findVariable(
                context.sourceCode.getScope(node),
                callee.object.name,
              )?.defs[0];
              if (
                binding?.type === 'ImportBinding' &&
                binding.parent.source.value ===
                  '@porcelain/contracts/reviews' &&
                binding.node.imported?.name === 'ReviewToolkit'
              ) {
                const object = node.arguments[0];
                if (object?.type !== 'ObjectExpression') {
                  context.report({
                    node,
                    message:
                      'Declare native toolkit handlers explicitly, because every tool must dispatch one shared use case.',
                  });
                  return;
                }
                for (const property of object.properties) {
                  if (!isFunction(property.value))
                    context.report({
                      node: property,
                      message:
                        'Declare each MCP operation as a callback, because domain sequencing belongs to its shared use case.',
                    });
                  else handlers.push({ handler: property.value, executes: 0 });
                }
                return;
              }
            }
            const path = memberPath(callee);
            if (path?.[0] !== 'useCases') return;
            const current = handlers.find((entry) =>
              within(node, entry.handler),
            );
            if (!current) return;
            if (path.at(-1) === 'execute') current.executes += 1;
            else
              context.report({
                node,
                message:
                  'An MCP handler calls only execute on its use case, because domain sequencing belongs to the use case shared by every transport.',
              });
          },
          'Program:exit'() {
            for (const entry of handlers)
              if (entry.executes !== 1)
                context.report({
                  node: entry.handler,
                  message:
                    'An MCP handler calls one use case once, because sequencing several operations belongs in one shared use case.',
                });
          },
        };
      },
    },
    'no-schema-parse-in-typed-code': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (
          !useCaseSource.test(path) &&
          !typedPackageSource.test(path) &&
          !useCaseFile.test(repositoryPath(context))
        )
          return {};
        const trusted = (node) =>
          node?.type === 'Identifier' && trustedParsers.has(node.name);
        const report = (node, name) => {
          if (aliasedParseMethods.has(name ?? ''))
            context.report({
              node,
              message:
                'Validate untrusted data at transport boundaries, because domain and use-case inputs have already been validated.',
            });
        };
        return {
          ImportSpecifier(node) {
            report(node, node.imported.name ?? node.imported.value);
          },
          MemberExpression(node) {
            if (!trusted(node.object))
              report(node, propertyName(node, context));
          },
          ObjectPattern(node) {
            if (trusted(node.parent?.init)) return;
            for (const property of node.properties)
              if (property.type === 'Property')
                report(property, propertyName(property, context));
          },
          CallExpression(node) {
            if (memberPath(node.callee)?.[0] === 'Reflect')
              report(node, staticString(node.arguments[1], context));
          },
        };
      },
    },

    'no-node-globals': {
      create(context) {
        const path = repositoryPath(context);
        if (!nodeGlobalScope.test(path)) return {};
        const role = classify(path)?.role;
        if (role === 'test' || (role && nodeGlobalRoles.has(role))) return {};
        return {
          'Program:exit'(program) {
            for (const identifier of globalReferences(
              context,
              program,
              nodeGlobals,
            ))
              context.report({
                node: identifier,
                message: `${identifier.name} is Node; reach it through a port that a gateway, repository or server adapter implements, because machine access must remain replaceable through a port.`,
              });
          },
        };
      },
    },

    'adapters-never-import-services': {
      create(context) {
        const path = repositoryPath(context);
        const adapter = adapterFile.test(path);
        const port = portFile.exec(path);
        if ((!adapter && !port) || isSpec(context)) return {};
        return moduleVisitors((node) => {
          const source = moduleSource(node);
          if (source === undefined) return;
          if (adapter && /^@porcelain\/[^/]+\/services(?:\/|$)/.test(source))
            context.report({
              node: node.source,
              message:
                'An adapter wraps Git, files, storage or a model provider; it never calls a domain service. The use case sequences domains, because cross-domain orchestration belongs in the use case.',
            });
          const target = /^@porcelain\/([^/]+)/.exec(source)?.[1];
          if (
            port &&
            target &&
            target !== port[1] &&
            target !== 'kernel' &&
            target !== 'effects' &&
            !(source === '@porcelain/git/errors' && typeOnlyImport(node))
          )
            context.report({
              node: node.source,
              message:
                'A port names only its own domain and @porcelain/kernel; another domain is read through its services in the use case, because cross-domain orchestration belongs in the use case.',
            });
        });
      },
    },

    'adapters-report-facts': {
      create(context) {
        if (!adapterFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const message =
          'An adapter reports every entry and never names .git: whether the Git folder is shown is a rule the service applies, and an adapter that must look for it takes the name from gitDirectoryName() through its options, because filtering in an adapter hides facts from the domain rule.';
        const check = (node) => {
          if (staticString(node, context)?.toLowerCase() === '.git')
            context.report({ node, message });
        };
        return {
          Literal: check,
          TemplateLiteral: check,
          BinaryExpression(node) {
            if (
              node.operator === '+' &&
              node.parent?.type !== 'BinaryExpression'
            )
              check(node);
          },
        };
      },
    },
    'root-scripts-import-no-package': {
      create(context) {
        const path = repositoryPath(context);
        if (!rootScriptFile.test(path)) return {};
        return moduleVisitors((node) => {
          const source = moduleSource(node);
          if (source === undefined) return;
          if (
            path === 'scripts/feature-api-routes.ts' &&
            /^@porcelain\/contracts\/(?:access|changes|files|git-actions|projects|reviews|shared)$/.test(
              source,
            )
          )
            return;
          const target = source.startsWith('.')
            ? posix.join(posix.dirname(path), source)
            : source;
          if (
            target.startsWith('packages/') ||
            target.startsWith('@porcelain/')
          )
            context.report({
              node: node.source ?? node,
              message:
                'A root script imports node, libraries, other scripts, architecture/ and the server app only; it never imports a package, by name or by a path into packages/: take what it needs from the server app or declare it in the script, because package internals must remain behind the server composition boundary.',
            });
        });
      },
    },
    'typed-evaluation': {
      create(context) {
        if (!evaluatingFile.test(repositoryPath(context))) return {};
        return {
          CallExpression(node) {
            const source = node.arguments[0];
            if (
              node.callee.type !== 'MemberExpression' ||
              !evaluationMethods.has(memberName(node.callee)) ||
              (source?.type !== 'TemplateLiteral' &&
                !(
                  source?.type === 'Literal' && typeof source.value === 'string'
                ))
            )
              return;
            context.report({
              node: source,
              message:
                'Pass a function, never source text, to evaluate: a typed function stops compiling when the desktop bridge or the page it reads changes, while a string only breaks at runtime on the machine that runs it, because source strings escape TypeScript and only fail at runtime.',
            });
          },
        };
      },
    },

    'timers-in-runtime': {
      create(context) {
        const path = repositoryPath(context);
        if (
          !serverAppFile.test(path) ||
          runtimeFile.test(path) ||
          isSpec(context)
        )
          return {};
        const message =
          'A schedule lives in apps/server/src/runtime: repeating work is an IntervalJob, a wait is a runtime helper; setTimeout and setInterval appear nowhere else, because the runtime owns cancellation and shutdown of scheduled work.';
        return {
          ...moduleVisitors((node) => {
            const source = moduleSource(node);
            if (source !== undefined && timerModule.test(source))
              context.report({ node: node.source ?? node, message });
          }),
          'Program:exit'(program) {
            for (const identifier of globalReferences(
              context,
              program,
              timerGlobals,
            ))
              context.report({ node: identifier, message });
          },
        };
      },
    },
    'fixture-imports': {
      create(context) {
        const path = repositoryPath(context);
        if (!fixtureFile.test(path)) return {};
        if (captureFile.test(path))
          return moduleVisitors((node) => {
            const source = moduleSource(node);
            if (source === undefined || !captureModules.has(source))
              context.report({
                node: node.source ?? node,
                message:
                  'A capture script runs Git in a disposable repository with node:child_process, node:fs, node:os, node:path and node:url only; it imports nothing from the repository, because fixtures derived by product logic can repeat the same bug as the unit.',
              });
          });
        return moduleVisitors((node) => {
          const source = moduleSource(node);
          if (source !== undefined && fixtureModules.has(source)) return;
          if (
            node.type === 'ImportDeclaration' &&
            node.importKind === 'type' &&
            source !== undefined &&
            fixtureModelSource.test(source)
          )
            return;
          context.report({
            node: node.source ?? node,
            message:
              'A fixture reads captured output with node:fs, node:path and node:url, and imports only types from its own package models and the kernel models, because fixtures derived by product logic can repeat the same bug as the unit.',
          });
        });
      },
    },
    'events-after-lane': {
      create(context) {
        if (!useCaseFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const reported = new Set();
        return {
          CallExpression(node) {
            for (const callback of laneCallbacks(node, context))
              for (const call of callsInWork(
                callback,
                context,
                new Set(),
                true,
              )) {
                if (call.callee.type !== 'MemberExpression') continue;
                const owner = yieldedCapability(call.callee.object, context);
                if (
                  owner?.name !== 'EventPublisher' ||
                  !/(?:^|\/)ports\/event-publisher\.ts$/.test(owner.source) ||
                  propertyName(call.callee, context) ===
                    'gitActionProgressed' ||
                  reported.has(call)
                )
                  continue;
                reported.add(call);
                context.report({
                  node: call,
                  message:
                    'Publish after the lane settles: return whether anything changed and publish after the operation returns, or from its succeeded/settled/committed hook, because subscribers must observe committed state rather than an in-progress write.',
                });
              }
          },
        };
      },
    },
    'events-from-use-cases': {
      create(context) {
        const path = repositoryPath(context);
        if (
          !serverAppFile.test(path) ||
          /^apps\/server\/src\/(?:use-cases|bootstrap|ports)\//.test(path) ||
          isSpec(context)
        )
          return {};
        const imports = [];
        return {
          ImportDeclaration(node) {
            if (
              typeof node.source.value === 'string' &&
              /(?:^|\/)ports\/event-publisher\.ts$/.test(node.source.value)
            )
              for (const specifier of node.specifiers)
                if (
                  specifier.type === 'ImportNamespaceSpecifier' ||
                  specifier.imported?.name === 'EventPublisher'
                )
                  imports.push({ node, specifier });
          },
          'Program:exit'() {
            for (const { node, specifier } of imports) {
              const references =
                findVariable(
                  context.sourceCode.getScope(node),
                  specifier.local.name,
                )?.references.filter((reference) => reference.isRead()) ?? [];
              if (
                adapterFile.test(path) &&
                references.length > 0 &&
                references.every(
                  ({ identifier }) =>
                    identifier.parent?.type === 'CallExpression' &&
                    identifier.parent.arguments[0] === identifier &&
                    nativeMember(
                      identifier.parent,
                      context,
                      'Layer',
                      new Set(['effect']),
                    ),
                )
              )
                continue;
              context.report({
                node,
                message:
                  'Only a use case publishes, after its lane settles and only on change; the runtime, transport and adapters announce through a use case, never through the EventPublisher directly, because one owner decides when a completed change needs an event.',
              });
            }
          },
        };
      },
    },
    'use-case-computes': {
      create(context) {
        if (!useCaseFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const message =
          'A use case orchestrates and computes; a decision that ends in an error belongs in a service with its one private failure(problem), and the use case calls that service, because the service owns the mapping from domain failures to errors.';
        return {
          ThrowStatement(node) {
            context.report({ node, message });
          },
          NewExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              /Error$/.test(node.callee.name)
            )
              context.report({ node, message });
          },
          CallExpression(node) {
            if (memberPath(node.callee)?.join('.') === 'Promise.reject')
              context.report({ node, message });
          },
        };
      },
    },
    'failure-in-service': {
      create(context) {
        if (
          isSpec(context) ||
          !/^packages\/[^/]+\/src\/errors\/(?!index\.ts$)[^/]+\.ts$/.test(
            repositoryPath(context),
          )
        )
          return {};
        return {
          Program(node) {
            const exports = node.body.filter(
              (entry) =>
                entry.type === 'ExportNamedDeclaration' ||
                entry.type === 'ExportDefaultDeclaration' ||
                entry.type === 'ExportAllDeclaration',
            );
            const declaration = exports[0]?.declaration;
            const tagged =
              declaration?.superClass?.type === 'CallExpression' &&
              nativeMember(
                declaration.superClass.callee,
                context,
                'Schema',
                new Set(['TaggedError']),
              );
            if (
              exports.length !== 1 ||
              declaration?.type !== 'ClassDeclaration' ||
              !tagged
            )
              context.report({
                node,
                message:
                  'An errors/ file exports one tagged error, because a named failure gives every caller the same typed outcome.',
              });
          },
        };
      },
    },
    'cross-domain-through-use-cases': {
      create(context) {
        const path = repositoryPath(context);
        if (!portFile.test(path) || indexFile.test(path) || isSpec(context))
          return {};
        return {
          TSMethodSignature(node) {
            if (propertyName(node, context) === 'execute')
              context.report({
                node,
                message:
                  "A domain port is named for the fact it reads or writes, never execute: a port shaped like another domain's service carries that domain in disguise; the use case calls the other domain and passes the data on, because a service-shaped port hides a dependency on another domain.",
              });
          },
        };
      },
    },
    'use-case-input-is-contract': {
      create(context) {
        const path = repositoryPath(context);
        if (!useCaseFile.test(path) || isSpec(context)) return {};
        const name = posix.basename(path, '.ts');
        const behindPort = existsSync(
          posix.join(
            repositoryRoot,
            'apps/server/src/ports',
            `${name}-use-case-port.ts`,
          ),
        );
        if (behindPort) return {};
        const references = (annotation) => {
          if (
            annotation?.type === 'TSIntersectionType' ||
            annotation?.type === 'TSUnionType'
          )
            return annotation.types.flatMap(references);
          if (annotation?.type === 'TSParenthesizedType')
            return references(annotation.typeAnnotation);
          return [annotation];
        };
        return {
          ClassDeclaration(node) {
            const shape = nativeOperation(node, context)?.callee.typeArguments
              ?.params[1];
            if (shape?.type !== 'TSTypeLiteral') return;
            const execute = shape.members.find(
              (member) =>
                member.type === 'TSPropertySignature' &&
                member.key.name === 'execute',
            )?.typeAnnotation?.typeAnnotation;
            if (
              execute?.type !== 'TSFunctionType' ||
              execute.params.length === 0
            )
              return;
            const annotation = execute.params[0].typeAnnotation?.typeAnnotation;
            for (const reference of references(annotation)) {
              const binding =
                reference?.type === 'TSTypeReference'
                  ? importedBinding(reference.typeName, context)
                  : undefined;
              if (!binding?.source.startsWith('@porcelain/contracts/'))
                context.report({
                  node: reference ?? node,
                  message:
                    'A use case reached from a route takes the contract types its route validated (params, query, body), intersected as the route passes them; one reached only from another use case, a hook or the runtime stands behind ports/<name>-use-case-port.ts and may take a domain model, because copying the validated input lets the transport and use case drift.',
                });
            }
          },
        };
      },
    },
    'limits-from-settings': {
      create(context) {
        const path = repositoryPath(context);
        if (
          !serverAppFile.test(path) ||
          path.startsWith('apps/server/src/config/') ||
          isSpec(context)
        )
          return {};
        return {
          ImportDeclaration(node) {
            if (
              typeof node.source.value === 'string' &&
              /(?:^|\/)config\/limits\.ts$/.test(node.source.value) &&
              node.specifiers.some(
                (specifier) =>
                  specifier.type === 'ImportSpecifier' &&
                  specifier.imported.type === 'Identifier' &&
                  specifier.imported.name === 'LIMITS' &&
                  node.importKind !== 'type',
              )
            )
              context.report({
                node,
                message:
                  'Only config reads LIMITS; everything else receives settings.limits (or the part it needs) as an option, so the fixture and a test can change it.',
              });
          },
        };
      },
    },
    'no-nested-lane': {
      create(context) {
        if (!useCaseFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const reported = new Set();
        return {
          CallExpression(node) {
            for (const callback of laneCallbacks(node, context))
              for (const inner of callsInWork(
                callback,
                context,
                new Set(),
                true,
              )) {
                const owner =
                  inner.callee.type === 'MemberExpression'
                    ? yieldedCapability(inner.callee.object, context)
                    : undefined;
                const entersLane =
                  takesLane(inner, context) ||
                  (owner?.name === 'CheckWorktreeUseCasePort' &&
                    /(?:^|\/)ports\/check-worktree-use-case-port\.ts$/.test(
                      owner.source,
                    ) &&
                    memberName(inner.callee) === 'execute') ||
                  (/^Refresh[A-Z].*UseCasePort$/.test(owner?.name ?? '') &&
                    /(?:^|\/)ports\/refresh-[^/]+-use-case-port\.ts$/.test(
                      owner.source,
                    ) &&
                    memberName(inner.callee) === 'execute');
                if (
                  !entersLane ||
                  independentlyScheduled(inner, context) ||
                  reported.has(inner)
                )
                  continue;
                reported.add(inner);
                context.report({
                  node: inner,
                  message:
                    'A lane never runs inside another lane: resolve the worktree, refresh the inventory and take any other lane before or after this one, or acquire multiple owner keys in one operation, because nested serial queues can wait on each other indefinitely.',
                });
              }
          },
        };
      },
    },
    'lane-only-with-store': {
      create(context) {
        if (!useCaseFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const visitorKeys = context.sourceCode.visitorKeys;
        return {
          ClassDeclaration(node) {
            const holds = nodesOf(
              node,
              visitorKeys,
              (entry) => entry.type === 'YieldExpression' && entry.delegate,
            ).some((entry) => {
              const capability = importedBinding(entry.argument, context);
              return (
                capability &&
                ((laneHolderType.test(capability.name) &&
                  (/^@porcelain\/[^/]+\/(?:services|ports)$/.test(
                    capability.source,
                  ) ||
                    /(?:^|\/)ports\/[^/]+\.ts$/.test(capability.source))) ||
                  (capability.name === 'WorktreeAccess' &&
                    /(?:^|\/)runtime\/worktree-access\.ts$/.test(
                      capability.source,
                    )))
              );
            });
            if (holds) return;
            for (const call of nodesOf(node, visitorKeys, (entry) =>
              takesLane(entry, context),
            ))
              context.report({
                node: call,
                message:
                  'A lane serializes access to something: a use case that yields no store, reader, runner, writer, source, service, worktree access or use-case port computes without a lane (lanes.unqueued at most), because serializing pure computation needlessly blocks other work.',
              });
          },
        };
      },
    },
    'rules-are-pure': {
      create(context) {
        if (!ruleFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const checkModule = (node) => {
          const source = moduleSource(node);
          if (source === undefined) return;
          const name = source.replace(/^node:/, '');
          if (
            !source.startsWith('node:') &&
            !nodeBuiltins.has(name.split('/')[0] ?? '')
          )
            return;
          const pure =
            name === 'crypto' &&
            node.type === 'ImportDeclaration' &&
            node.specifiers.every(
              (specifier) =>
                specifier.type === 'ImportSpecifier' &&
                pureCrypto.has(
                  specifier.imported.name ?? specifier.imported.value,
                ),
            );
          if (!pure)
            context.report({
              node: node.source,
              message:
                'A rule is pure: from node it imports only createHash and timingSafeEqual from node:crypto, because the same inputs must yield the same result on every machine.',
            });
        };
        return {
          ...moduleVisitors(checkModule),
          ThrowStatement(node) {
            context.report({
              node,
              message:
                'A rule returns a value or an outcome; the service decides to throw, because the same inputs must yield the same result on every machine.',
            });
          },
          NewExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'Date' &&
              node.arguments.length === 1 &&
              node.arguments[0].type !== 'SpreadElement'
            )
              return;
            if (
              node.callee.type !== 'Identifier' ||
              !pureConstructors.has(node.callee.name)
            )
              context.report({
                node,
                message:
                  'A rule constructs only Map, Set, RegExp and a Date from one given instant; errors, the current time and buffers belong in services and adapters, because the same inputs must yield the same result on every machine.',
              });
          },
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              /(?:^|[a-z])Error$/.test(node.callee.name)
            )
              context.report({
                node,
                message:
                  'A rule returns a value or an outcome; it never builds an error, with or without new, because the same inputs must yield the same result on every machine.',
              });
          },
          'Program:exit'(program) {
            for (const identifier of globalReferences(
              context,
              program,
              pureGlobals,
            )) {
              const problem = impureGlobalUse(identifier, context);
              if (problem)
                context.report({ node: identifier, message: problem });
            }
          },
        };
      },
    },
    'static-imports': {
      create(context) {
        if (!serverSource.test(repositoryPath(context)) || isSpec(context))
          return {};
        return {
          ImportExpression(node) {
            if (moduleSource(node) === undefined)
              context.report({
                node,
                message:
                  'Import a module by a literal path; a computed import() hides a dependency from arch:check, because computed module paths escape dependency analysis.',
              });
          },
        };
      },
    },
    'no-blocking-child-process': {
      create(context) {
        if (!serverSource.test(repositoryPath(context)) || isSpec(context))
          return {};
        const namespaces = new Set();
        const report = (node, name) =>
          context.report({
            node,
            message: `${name} blocks the server's event loop until the command ends, stalling every request; run it with runCommand from @porcelain/process, which spawns it asynchronously with a deadline and an output limit, because synchronous commands stall every server request.`,
          });
        return {
          ImportDeclaration(node) {
            if (!childProcessModules.has(node.source.value)) return;
            for (const specifier of node.specifiers) {
              if (specifier.type !== 'ImportSpecifier') {
                namespaces.add(specifier.local.name);
                continue;
              }
              const name = specifier.imported.name ?? specifier.imported.value;
              if (blockingChildProcess.has(name)) report(specifier, name);
            }
          },
          MemberExpression(node) {
            const name = node.property.name ?? node.property.value;
            if (
              node.object.type === 'Identifier' &&
              namespaces.has(node.object.name) &&
              blockingChildProcess.has(name)
            )
              report(node, name);
          },
        };
      },
    },
    'one-clock': {
      create(context) {
        const path = repositoryPath(context);
        if (!serverCode.test(path) || clockFile.test(path) || isSpec(context))
          return {};
        return {
          'Program:exit'(program) {
            for (const identifier of globalReferences(
              context,
              program,
              new Set(['Date']),
            ))
              context.report({
                node: identifier,
                message:
                  'Time comes from native Effect Clock and DateTime; Date arithmetic lives in rules/ and adapters/ only, because tests must control the instant an operation observes.',
              });
          },
        };
      },
    },

    'imports-by-path': {
      create(context) {
        const path = repositoryPath(context);
        const owner = packageCode.exec(path)?.[1];
        if (owner === undefined || isSpec(context)) return {};
        return {
          ...moduleVisitors((node) => {
            const source = moduleSource(node);
            if (source === undefined) return;
            if (
              source === `@porcelain/${owner}` ||
              source.startsWith(`@porcelain/${owner}/`)
            )
              context.report({
                node: node.source,
                message:
                  'Inside a package, import a file by its relative path, never the package by name, because a barrel can introduce hidden cycles and bypass dependency ownership.',
              });
            if (
              source.startsWith('.') &&
              /(?:^|\/)index\.ts$/.test(source) &&
              !importsAnotherGitCapability(path, source)
            )
              context.report({
                node: node.source,
                message:
                  'Import the file itself; an index.ts exists for package.json exports only, because a barrel can introduce hidden cycles and bypass dependency ownership.',
              });
          }),
          Program(program) {
            if (!indexFile.test(path)) return;
            for (const statement of program.body)
              if (
                statement.type !== 'ExportAllDeclaration' &&
                (statement.type !== 'ExportNamedDeclaration' ||
                  !statement.source)
              )
                context.report({
                  node: statement,
                  message:
                    'An index.ts holds export ... from statements only, because a barrel can introduce hidden cycles and bypass dependency ownership.',
                });
          },
        };
      },
    },

    'fakes-store': {
      create(context) {
        const fake = fakeFile.test(repositoryPath(context));
        if (!fake && !isSpec(context)) return {};
        const visitorKeys = context.sourceCode.visitorKeys;
        const portClasses = [];
        const classes = [];
        const inFake = () => fake || portClasses.length > 0;
        const recorder = () =>
          recordingFake.test(classes.at(-1)?.id?.name ?? '');
        const enter = (node) => {
          classes.push(node);
          if ((node.implements ?? []).length > 0) portClasses.push(node);
        };
        const leave = (node) => {
          if (classes.at(-1) === node) classes.pop();
          if (portClasses.at(-1) === node) portClasses.pop();
        };
        const report = (node, message) => {
          if (inFake()) context.report({ node, message });
        };
        const decision =
          'A fake stores and returns; a decision belongs in rules/ and the port gets simpler, because a fake that decides can duplicate the product bug under test.';
        const recording =
          'A fake stores state, it never records calls; assert through what the port reads back, or name it Recording<Port> when the port answers nothing back, because a fake that decides can duplicate the product bug under test.';
        const records = (node) => {
          if (!recorder()) report(node, recording);
        };
        const decides = (node) => report(node, decision);
        const onField = (node) =>
          node?.type === 'MemberExpression' && rootedAtThis(node);
        return {
          ClassDeclaration: enter,
          ClassExpression: enter,
          'ClassDeclaration:exit': leave,
          'ClassExpression:exit': leave,
          IfStatement: decides,
          SwitchStatement: decides,
          ForStatement: decides,
          ForInStatement: decides,
          ForOfStatement: decides,
          WhileStatement: decides,
          DoWhileStatement: decides,
          ConditionalExpression: decides,
          LogicalExpression(node) {
            if (
              node.parent?.type === 'ExpressionStatement' ||
              hasEffect(node.left, visitorKeys) ||
              hasEffect(node.right, visitorKeys)
            )
              report(
                node,
                'A fake stores and returns; &&, || and ?? that choose whether something is stored are an if, and a decision belongs in rules/, because a fake that decides can duplicate the product bug under test.',
              );
          },
          ThrowStatement(node) {
            report(
              node,
              'A fake never throws; script the outcome through what the port returns, because a fake that decides can duplicate the product bug under test.',
            );
          },
          AssignmentExpression(node) {
            if (['&&=', '||=', '??='].includes(node.operator)) decides(node);
            if (!onField(node.left)) return;
            if (node.left.object.type === 'MemberExpression') records(node);
            if (node.operator !== '=') records(node);
            const appended =
              node.right.type === 'ArrayExpression' &&
              node.right.elements.some(
                (element) =>
                  element?.type === 'SpreadElement' &&
                  onField(element.argument) &&
                  context.sourceCode.getText(element.argument) ===
                    context.sourceCode.getText(node.left),
              );
            if (appended) records(node);
          },
          UpdateExpression: records,
          PropertyDefinition(node) {
            if (!node.static && !node.readonly && !isPrivateMember(node))
              report(
                node,
                'A fake keeps its state private and readonly; seed it through the constructor and read it back through the port, because a fake that decides can duplicate the product bug under test.',
              );
          },
          CallExpression(node) {
            const name =
              node.callee.type === 'MemberExpression'
                ? propertyName(node.callee, context)
                : undefined;
            if (
              (name === 'push' || name === 'unshift') &&
              node.callee.object.type === 'MemberExpression'
            )
              records(node);
            if (
              (name === 'set' || name === 'add') &&
              onField(node.callee.object) &&
              !fromInput(node.arguments[0], context)
            )
              records(node);
            const gated = receiverCalls(node).some((call) =>
              gatingMethods.has(call ?? ''),
            );
            if (
              gated &&
              (name === 'forEach' ||
                node.parent?.type === 'ExpressionStatement')
            )
              report(
                node,
                'A fake stores and returns; a filter that decides whether to store is an if. Keep the change as its own stored state and compose it when the port reads, because a fake that decides can duplicate the product bug under test.',
              );
            if (memberPath(node.callee)?.join('.') === 'Promise.reject')
              report(
                node,
                'A fake never rejects; script the outcome through what the port returns, because a fake that decides can duplicate the product bug under test.',
              );
          },
        };
      },
    },
    'spec-no-clock': {
      create(context) {
        if (!timedTest(context)) return {};
        const message =
          'Tests await the event that marks the milestone, never time: use fixed instants, the TestClock, Vitest fake timers or a clock passed through the port, because wall clocks make fixtures drift and elapsed-time assertions measure host load as well as code.';
        const date = (callee) =>
          ['Date', 'globalThis.Date', 'window.Date', 'self.Date'].includes(
            timingPath(callee, context),
          );
        return {
          NewExpression(node) {
            if (
              node.arguments.length === 0 &&
              date(node.callee) &&
              !fakeClock(node, context, 'Date')
            )
              context.report({ node, message });
          },
          CallExpression(node) {
            if (date(node.callee) && !fakeClock(node, context, 'Date'))
              context.report({ node, message });
          },
          MemberExpression(node) {
            const owner = timingPath(node.object, context)?.replace(
              /^(?:globalThis|window|self)\./,
              '',
            );
            if (
              ['Date', 'performance'].includes(owner) &&
              (memberName(node) === 'now' ||
                (node.computed && memberName(node) === undefined)) &&
              !fakeClock(node, context, owner)
            )
              context.report({ node, message });
          },
        };
      },
    },
    'spec-no-waits': {
      create(context) {
        if (!timedTest(context) || browserSpec(context)) return {};
        const message =
          'Tests await the event that marks the milestone, never time: await a Deferred, a stream notice, a process event or expect.poll, or advance the TestClock, because fixed sleeps race machines with different speeds.';
        const delays = new Set(['delay', 'sleep', 'waitForTimeout']);
        function callsResolver(node, name) {
          if (!node || typeof node !== 'object') return false;
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            node.callee.name === name
          )
            return true;
          return Object.entries(node).some(
            ([field, value]) =>
              field !== 'parent' &&
              (Array.isArray(value)
                ? value.some((child) => callsResolver(child, name))
                : callsResolver(value, name)),
          );
        }
        return {
          ImportDeclaration(node) {
            if (
              ['node:timers/promises', 'timers/promises'].includes(
                node.source.value,
              )
            )
              for (const specifier of node.specifiers)
                if (specifier.imported?.name === 'setTimeout')
                  delays.add(specifier.local.name);
          },
          CallExpression(node) {
            const name =
              node.callee.type === 'Identifier'
                ? node.callee.name
                : node.callee.type === 'MemberExpression'
                  ? memberName(node.callee)
                  : undefined;
            if (
              delays.has(name) &&
              !(
                timingPath(node.callee, context) === 'Effect.sleep' &&
                testClockSleep(node, context)
              )
            )
              context.report({ node, message });
            if (name !== 'setTimeout') return;
            let executor = node.parent;
            while (
              executor &&
              ![
                'ArrowFunctionExpression',
                'FunctionExpression',
                'FunctionDeclaration',
              ].includes(executor.type)
            )
              executor = executor.parent;
            const promise = executor?.parent;
            if (
              promise?.type === 'NewExpression' &&
              promise.callee.type === 'Identifier' &&
              promise.callee.name === 'Promise' &&
              executor.params[0]?.type === 'Identifier'
            ) {
              const resolver = executor.params[0].name;
              const callback = node.arguments[0];
              if (
                (callback?.type === 'Identifier' &&
                  callback.name === resolver) ||
                (['ArrowFunctionExpression', 'FunctionExpression'].includes(
                  callback?.type,
                ) &&
                  callsResolver(callback.body, resolver))
              )
                context.report({ node, message });
            }
          },
        };
      },
    },
    'spec-no-mocking': {
      create(context) {
        if (!isSpec(context)) return browserSpecNoMocks(context);
        return {
          AssignmentExpression(node) {
            if (replacesGlobal(node))
              context.report({
                node,
                message:
                  'Specs observe globals without replacing them, because hand-written spies can pass without proving product behaviour.',
              });
          },
          CallExpression(node) {
            if (replacesGlobal(node))
              context.report({
                node,
                message:
                  'Specs observe globals without replacing them, because hand-written spies can pass without proving product behaviour.',
              });
          },
          ImportExpression(node) {
            if (moduleSource(node) === 'vitest')
              context.report({
                node,
                message:
                  'Import describe, it and expect statically by name; vitest is never loaded dynamically, because call assertions can pass without the promised observable behavior.',
              });
          },
          ImportDeclaration(node) {
            if (node.source.value !== 'vitest') return;
            for (const specifier of node.specifiers)
              if (
                specifier.type === 'ImportNamespaceSpecifier' ||
                specifier.type === 'ImportDefaultSpecifier' ||
                (specifier.imported.type === 'Identifier' &&
                  (specifier.imported.name === 'vi' ||
                    specifier.imported.name === 'vitest'))
              )
                context.report({
                  node: specifier,
                  message:
                    'Import describe, it and expect by name; replace vi with an in-memory fake typed by the port, because call assertions can pass without the promised observable behavior.',
                });
          },
          MemberExpression(node) {
            if (
              node.object.type === 'Identifier' &&
              node.object.name === 'vi'
            ) {
              context.report({
                node,
                message:
                  'Replace vi with an in-memory fake typed by the port, or a Clock or IdSource fake, because call assertions can pass without the promised observable behavior.',
              });
              return;
            }
            const matcher = memberName(node) ?? '';
            if (interactionMatchers.has(matcher) || spyMatcher.test(matcher))
              context.report({
                node: node.property,
                message:
                  'Assert on the result, on state read back through a port, or on the thrown error class, because call assertions can pass without the promised observable behavior.',
              });
          },
        };
      },
    },
    'spec-no-skips': {
      create(context) {
        if (
          browserSpec(context) &&
          !normalizedFilename(context.filename).includes('/apps/desktop/')
        )
          return browserSpecNoSkips(context);
        if (!antiFlakeSpec(context)) return {};
        const message =
          'Every spec runs every time; remove the skip, only, todo, fails, fixme or fail, because a skipped or exclusive case leaves regressions unchecked.';
        return {
          MemberExpression(node) {
            const testMember = testFunctions.has(chainRoot(node) ?? '');
            const gate =
              node.parent?.type === 'CallExpression'
                ? node.parent.arguments[0]
                : undefined;
            if (
              !isSpec(context) &&
              testMember &&
              ['skipIf', 'runIf'].includes(memberName(node)) &&
              gate?.type === 'BinaryExpression' &&
              ['===', '!=='].includes(gate.operator) &&
              [
                [gate.left, gate.right],
                [gate.right, gate.left],
              ].some(
                ([platform, target]) =>
                  memberPath(platform)?.join('.') === 'process.platform' &&
                  target.type === 'Literal' &&
                  ['linux', 'darwin', 'win32'].includes(target.value),
              )
            )
              return;
            if (testMember && node.computed && memberName(node) === undefined) {
              context.report({
                node: node.property,
                message:
                  'Call describe, it and test by their names; a computed member hides a skip, because a skipped or exclusive case leaves regressions unchecked.',
              });
              return;
            }
            if (
              ((skippingModifiers.has(memberName(node) ?? '') ||
                ['fixme', 'fail'].includes(memberName(node))) &&
                testMember) ||
              (!node.computed && memberName(node) === 'skip')
            )
              context.report({ node: node.property, message });
          },
          ObjectPattern(node) {
            for (const property of node.properties)
              if (
                property.type === 'Property' &&
                propertyName(property, context) === 'skip'
              )
                context.report({ node: property, message });
          },
        };
      },
    },
    'spec-one-case-per-behaviour': {
      create(context) {
        if (!isSpec(context)) return {};
        return {
          CallExpression(node) {
            if (
              node.callee.type !== 'Identifier' ||
              node.callee.name !== 'expect'
            )
              return;
            for (const ancestor of context.sourceCode
              .getAncestors(node)
              .reverse()) {
              if (
                isFunction(ancestor) &&
                ancestor.parent?.type === 'CallExpression' &&
                caseFunctions.has(chainRoot(ancestor.parent.callee) ?? '')
              )
                return;
              const loop =
                loopTypes.has(ancestor.type) ||
                (isFunction(ancestor) &&
                  ancestor.parent?.type === 'CallExpression' &&
                  ancestor.parent.callee.type === 'MemberExpression' &&
                  propertyName(ancestor.parent.callee, context) === 'forEach');
              if (loop) {
                context.report({
                  node,
                  message:
                    'One case per behaviour: turn the loop into it.each with a sentence title per row, because a loop can run zero assertions and hides which input failed.',
                });
                return;
              }
            }
          },
        };
      },
    },
    'spec-asserts': {
      create(context) {
        const spec = isSpec(context);
        if (!spec && !testSource.test(normalizedFilename(context.filename)))
          return {};
        const hollow = {
          Program(program) {
            for (const report of hollowTests(program, context.sourceCode, {
              spec,
            }))
              context.report(report);
          },
        };
        const suiteFunctions = new Set(['describe', 'suite']);
        const inSuiteBody = (statement) => {
          const block = statement.parent;
          if (block?.type === 'Program') return true;
          const owner = block?.parent;
          return (
            block?.type === 'BlockStatement' &&
            isFunction(owner) &&
            owner.parent?.type === 'CallExpression' &&
            suiteFunctions.has(chainRoot(owner.parent.callee) ?? '')
          );
        };
        return {
          ...hollow,
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'expect' &&
              node.arguments[0]?.type === 'Literal' &&
              typeof node.arguments[0].value === 'boolean'
            )
              context.report({
                node,
                message:
                  'Assert on an observable result instead of a boolean literal, because a fixed literal cannot detect a product regression.',
              });
            if (!spec) return;
            if (
              caseCall(node, context) &&
              node.parent?.type !== 'MemberExpression' &&
              !(
                node.parent?.type === 'CallExpression' &&
                node.parent.callee === node
              ) &&
              (node.parent?.type !== 'ExpressionStatement' ||
                !inSuiteBody(node.parent))
            )
              context.report({
                node,
                message:
                  'Register every case as a statement of its describe; a case inside a condition, loop or helper may never run, because a case must detect a change in observable behavior.',
              });
            if (
              node.callee.type !== 'Identifier' ||
              node.callee.name !== 'expect'
            )
              return;
            let chain = node;
            while (
              chain.parent?.type === 'MemberExpression' &&
              chain.parent.object === chain
            )
              chain = chain.parent;
            if (
              chain === node ||
              chain.parent?.type !== 'CallExpression' ||
              chain.parent.callee !== chain
            )
              context.report({
                node,
                message:
                  'Call a matcher such as toEqual, because expect(actual) alone asserts nothing.',
              });
            for (const ancestor of context.sourceCode
              .getAncestors(node)
              .reverse()) {
              if (!isFunction(ancestor)) continue;
              const call = ancestor.parent;
              if (call?.type === 'CallExpression' && caseCall(call, context))
                return;
              if (
                effectMember(
                  call,
                  context,
                  new Set(['gen', 'promise', 'sync']),
                ) &&
                executedEffectBody(call, context)
              )
                continue;
              if (
                call?.type === 'CallExpression' &&
                call.callee.type === 'MemberExpression' &&
                call.arguments.includes(ancestor)
              ) {
                context.report({
                  node,
                  message:
                    'Assert in the case body, not inside a callback; an expect in map, filter or forEach runs once per element, and not at all for none, because a case must detect a change in observable behavior.',
                });
                return;
              }
            }
          },
        };
      },
    },

    'spec-imports': {
      create(context) {
        if (!isSpec(context)) return {};
        const check = (node) => {
          const source = node.source?.value;
          if (typeof source !== 'string') {
            if (node.type === 'ImportExpression')
              context.report({
                node,
                message:
                  'A spec imports its modules statically, because computed paths hide dependencies from the unit boundary check.',
              });
            return;
          }
          if (!allowedSpecImport(context.filename, source))
            context.report({
              node: node.source,
              message:
                'A spec imports its sibling unit, native Effect test tools and the public APIs or real runtime resources needed by that unit; fakes belong at ports, because tests must exercise supported boundaries without repeating product decisions.',
            });
        };
        return {
          ImportDeclaration: check,
          ImportExpression: check,
          ExportNamedDeclaration(node) {
            if (node.source) check(node);
          },
          ExportAllDeclaration: check,
        };
      },
    },
    'models-are-types': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!modelsSource.test(path) || isSpec(context)) return {};
        const message =
          'Models hold types and canonical native Schema declarations; ports add Context.Service keys, because schemas and keys constrain boundaries while behavior stays in rules or services.';
        const report = (node) => context.report({ node, message });
        return {
          FunctionDeclaration: report,
          FunctionExpression: report,
          ArrowFunctionExpression: report,
          ClassDeclaration: report,
          ClassExpression: report,
          TSEnumDeclaration: report,
          VariableDeclaration(node) {
            if (
              !nativePortKey(node, context) &&
              !(
                node.kind === 'const' &&
                node.declarations.every(
                  (declaration) =>
                    declaration.id.type === 'Identifier' &&
                    /Schema$/.test(declaration.id.name) &&
                    nativeSchemaValue(declaration.init, context),
                )
              )
            )
              context.report({ node, message });
          },
          ImportDeclaration(node) {
            if (
              !typeOnlyImport(node) &&
              !(
                /\/models\//.test(path) &&
                node.specifiers.every(
                  (specifier) =>
                    specifier.type === 'ImportSpecifier' &&
                    (specifier.importKind === 'type' ||
                      (node.source.value === 'effect' &&
                        ['Schema', 'Struct'].includes(
                          specifier.imported.name,
                        )) ||
                      (/^(?:@porcelain\/[^/]+\/models|\.\.?\/[^/]+\.ts)$/.test(
                        node.source.value,
                      ) &&
                        /Schema$/.test(specifier.imported.name))),
                )
              ) &&
              !(
                /\/ports\//.test(path) &&
                node.source.value === 'effect' &&
                node.specifiers.every(
                  (specifier) =>
                    specifier.type === 'ImportSpecifier' &&
                    (specifier.importKind === 'type' ||
                      specifier.imported.name === 'Context'),
                )
              )
            )
              context.report({
                node,
                message:
                  'Models import types and canonical schemas only, because runtime business behavior belongs to rules and services.',
              });
          },
        };
      },
    },
    'bootstrap-constructs-only': {
      create(context) {
        if (!composeSource.test(normalizedFilename(context.filename)))
          return {};
        const message =
          'Composition builds objects only; defaults belong in config, starting and running in runtime, because construction must not start work that the runtime cannot shut down.';
        const report = (node) => context.report({ node, message });
        return {
          IfStatement: report,
          SwitchStatement: report,
          TryStatement: report,
          ConditionalExpression: report,
          WhileStatement: report,
          DoWhileStatement: report,
          LogicalExpression(node) {
            context.report({ node, message });
          },
          AssignmentExpression(node) {
            if (node.operator !== '=') context.report({ node, message });
          },
          AssignmentPattern(node) {
            context.report({ node, message });
          },
          'Program:exit'(program) {
            for (const identifier of globalReferences(
              context,
              program,
              new Set(['process', 'globalThis', 'global']),
            ))
              context.report({ node: identifier, message });
          },
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              ['setInterval', 'setTimeout', 'setImmediate'].includes(
                node.callee.name,
              )
            )
              context.report({ node, message });
            if (
              node.callee.type === 'MemberExpression' &&
              ['catch', 'then', 'execute', 'start'].includes(
                propertyName(node.callee, context) ?? '',
              )
            )
              context.report({ node, message });
          },
        };
      },
    },
    'no-comments': {
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments())
              context.report({
                loc: comment.loc,
                message:
                  'Remove the code comment; express the rule in code or a verification skill, because comment prose can drift from the behavior enforced by executable checks.',
              });
          },
        };
      },
    },
    'no-null-in-domain': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (
          (!domainSource.test(path) && !useCaseSource.test(path)) ||
          (useCaseSource.test(path) && isSpec(context))
        )
          return {};
        const message =
          'Use undefined for absence; null stays at the SQL and wire boundaries, because two representations of absence complicate every domain decision.';
        return {
          Literal(node) {
            if (node.value === null) context.report({ node, message });
          },
          TSNullKeyword(node) {
            context.report({ node, message });
          },
        };
      },
    },
    'use-case-imports': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!useCaseSource.test(path) || isSpec(context)) return {};
        const reexport = (node) =>
          context.report({
            node,
            message:
              'Use cases export their class only; they do not re-export, because orchestration must use public domain boundaries and validated contracts.',
          });
        return {
          ImportDeclaration(node) {
            const source = node.source.value;
            if (
              source === 'effect' ||
              (typeOnlyImport(node) &&
                /^@porcelain\/effects(?:\/worktree)?$/.test(source))
            )
              return;
            if (
              typeof source === 'string' &&
              /^\.\.\/\.\.\/(?:runtime|ports)\/[^/]+\.ts$/.test(source)
            )
              return;
            if (
              typeof source === 'string' &&
              (domainModule.test(source) ||
                /^@porcelain\/contracts\/[^/]+$/.test(source))
            ) {
              if (
                !typeOnlyImport(node) &&
                !(
                  source.endsWith('/services') &&
                  node.specifiers.every(
                    (specifier) =>
                      specifier.importKind === 'type' ||
                      /Service$/.test(specifier.imported?.name),
                  )
                )
              )
                context.report({
                  node,
                  message:
                    'Use cases import service capabilities as values and models and contracts as types, because Layers declare dependencies while orchestration consumes validated inputs.',
                });
              return;
            }
            if (
              typeof source === 'string' &&
              (useCaseValueModule.test(source) ||
                (source === '@porcelain/git/errors' && typeOnlyImport(node)))
            )
              return;
            context.report({
              node,
              message:
                'Use cases import only @porcelain/<domain>/services, @porcelain/<domain>/models, @porcelain/kernel/models, @porcelain/contracts/<domain> as types, @porcelain/<domain or kernel>/{rules,errors}, ../../runtime/<file> and ../../ports/<file>, because orchestration must use public domain boundaries and validated contracts.',
            });
          },
          ExportNamedDeclaration(node) {
            if (node.source) reexport(node);
          },
          ExportAllDeclaration: reexport,
        };
      },
    },
    'operation-class-shape': {
      create(context) {
        if (!operationRole(context.filename) || isSpec(context)) return {};
        const report = (node, requirement) =>
          context.report({
            node,
            message: `${requirement}, because operations expose one execute capability and Layers own their dependencies and cancellation.`,
          });
        return {
          TSTypeReference(node) {
            if (
              node.typeName.type === 'Identifier' &&
              ['AbortSignal', 'AbortController'].includes(node.typeName.name)
            )
              report(
                node,
                'Use Effect interruption instead of raw cancellation',
              );
          },
          ClassDeclaration(node) {
            const problem = nativeOperationProblem(node, context);
            if (problem) report(node, problem);
          },
          ClassExpression(node) {
            const problem = nativeOperationProblem(node, context);
            if (problem) report(node, problem);
          },
        };
      },
    },
    naming: {
      create(context) {
        const path = repositoryPath(context);
        if (!serverCode.test(path) || isSpec(context)) return {};
        const fake = fakeFile.test(path);
        const checkClass = (node) => {
          const name = node.id?.name;
          if (name === undefined) return;
          if (!pascalCase.test(name))
            context.report({
              node: node.id,
              message:
                'Name a class in PascalCase, because consistent role names give agents one naming pattern to copy.',
            });
          if (fake && !fakeName.test(name))
            context.report({
              node: node.id,
              message:
                'Name a fake InMemory<Port>, Scripted<Port>, Fixed<Port> or Sequential<Port>; Recording<Port> only for a port that answers nothing back, because consistent role names give agents one naming pattern to copy.',
            });
        };
        const checkField = (node, name) => {
          if (
            name !== undefined &&
            (!camelCase.test(name) || /(?:Service|Store)$/.test(name))
          )
            context.report({
              node,
              message:
                'Name a field in camelCase after its type, without the Service or Store suffix, because consistent role names give agents one naming pattern to copy.',
            });
        };
        return {
          ClassDeclaration: checkClass,
          ClassExpression: checkClass,
          PropertyDefinition(node) {
            if (!node.static) checkField(node.key, node.key.name);
          },
          TSParameterProperty(node) {
            const parameter =
              node.parameter.type === 'AssignmentPattern'
                ? node.parameter.left
                : node.parameter;
            checkField(parameter, parameter.name);
          },
          Program(program) {
            for (const statement of program.body) {
              const declaration =
                statement.type === 'ExportNamedDeclaration'
                  ? statement.declaration
                  : statement;
              if (
                declaration?.type !== 'VariableDeclaration' ||
                declaration.kind !== 'const'
              )
                continue;
              for (const declarator of declaration.declarations)
                if (
                  declarator.id.type === 'Identifier' &&
                  primitiveValue(declarator.init) &&
                  !screamingCase.test(declarator.id.name)
                )
                  context.report({
                    node: declarator.id,
                    message:
                      'Name a top-level constant of a primitive in SCREAMING_CASE, because consistent role names give agents one naming pattern to copy.',
                  });
            }
          },
        };
      },
    },

    'interfaces-only-in-ports': {
      create(context) {
        const path = repositoryPath(context);
        if (anyPortFile.test(path) || infrastructureInterfaceFile.test(path))
          return {};
        return {
          TSInterfaceDeclaration(node) {
            if (!serverCode.test(path)) return;
            if (
              context.sourceCode
                .getAncestors(node)
                .some(
                  (ancestor) =>
                    ancestor.type === 'TSModuleDeclaration' &&
                    ancestor.id?.type === 'Literal',
                )
            )
              return;
            context.report({
              node: node.id,
              message:
                'Write a type alias; an interface is a port and lives in ports/, because reserving interfaces for dependency contracts gives agents one place to declare and find ports.',
            });
          },
          TSMethodSignature(node) {
            if (!portShapedScope.test(path) || isSpec(context)) return;
            if (node.parent?.type !== 'TSTypeLiteral') return;
            context.report({
              node,
              message:
                'An object type with a method is a port in all but name: declare it in ports/ (interfaces/ in git, agents and process), where the port rules see it, because method-bearing contracts must follow the same port conventions instead of a second shape for agents to copy.',
            });
          },
        };
      },
    },
  },
};
