import { builtinModules } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, nodeGlobalRoles } from './policy.ts';

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
  /\/(?:packages\/(?:(?:access|changes|files|git-actions|projects|reviews)\/src\/models\/.+|kernel\/src\/(?:models|ports)\/.+)|apps\/server\/src\/ports\/.+)\.ts$/;
const composeSource =
  /\/apps\/server\/src\/bootstrap\/(?:.+\/)?compose-[^/]+\.ts$/;
const typedPackageSource =
  /\/packages\/[^/]+\/src\/(?:services|rules|models|ports)\//;
const routeSource = /\/apps\/server\/src\/http\/routes\/.+\.ts$/;
const pageSource = /-page\.ts$/;
const mcpSource = /\/apps\/server\/src\/http\/mcp\/.+\.ts$/;
const pageReplyMethods = new Set(['header', 'type']);
const parseMethods = new Set([
  'parse',
  'parseAsync',
  'safeParse',
  'safeParseAsync',
  'decode',
  'spa',
]);
const trustedParsers = new Set(['JSON', 'Date', 'Number', 'URL']);
const routeMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'route',
  'all',
]);
const requestKeys = new Set([
  'params',
  'body',
  'querystring',
  'query',
  'headers',
]);

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

function expectedClassName(filename, role) {
  const name = normalizedFilename(filename)
    .split('/')
    .at(-1)
    .slice(0, -3)
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  return role === 'UseCase' ? `${name}UseCase` : name;
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

function isPublicExecute(member) {
  return (
    member.type === 'MethodDefinition' &&
    member.kind === 'method' &&
    !member.static &&
    !isPrivateMember(member) &&
    member.key.type === 'Identifier' &&
    member.key.name === 'execute'
  );
}

function parameterName(parameter) {
  return parameter?.type === 'Identifier' ? parameter.name : undefined;
}

function executeSignatureProblem(role, execute) {
  const parameters = execute.value.params;
  const rest =
    parameterName(parameters[0]) === 'input' ? parameters.slice(1) : parameters;
  const last = rest[0];
  if (role === 'UseCase')
    return rest.length === 1 && parameterName(last) === 'context'
      ? undefined
      : 'Use case execute takes (context) or (input, context); the context always comes last.';
  return rest.length <= 1 &&
    (!last || (parameterName(last) === 'signal' && last.optional))
    ? undefined
    : 'Service execute takes (), (input), (signal?) or (input, signal?).';
}

function openParameterType(annotation) {
  if (!annotation) return false;
  if (openTypes.has(annotation.type)) return true;
  if (annotation.type === 'TSTypeLiteral')
    return annotation.members.length === 0;
  if (
    annotation.type !== 'TSTypeReference' ||
    annotation.typeName.type !== 'Identifier' ||
    annotation.typeName.name !== 'Record'
  )
    return false;
  const [key] =
    (annotation.typeArguments ?? annotation.typeParameters)?.params ?? [];
  return key?.type === 'TSNeverKeyword';
}

function objectProperty(object, name) {
  return object?.type === 'ObjectExpression'
    ? object.properties.find(
        (entry) =>
          entry.type === 'Property' &&
          entry.key.type === 'Identifier' &&
          entry.key.name === name,
      )
    : undefined;
}

function isUseCaseExecute(callee) {
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'execute' &&
    callee.object.type === 'MemberExpression' &&
    !callee.object.computed &&
    callee.object.object.type === 'Identifier' &&
    callee.object.object.name === 'options' &&
    callee.object.property.type === 'Identifier' &&
    callee.object.property.name === 'useCase'
  );
}

function handlerCall(handler) {
  if (handler?.type !== 'ArrowFunctionExpression') return undefined;
  let body = handler.body;
  if (body.type === 'BlockStatement') {
    if (body.body.length !== 1 || body.body[0].type !== 'ReturnStatement')
      return undefined;
    body = body.body[0].argument;
  }
  return body?.type === 'CallExpression' ? body : undefined;
}

function isStringLiteral(node) {
  return node.type === 'Literal' && typeof node.value === 'string';
}

const presenterModule = /(?:^|\/)presenters\/[^/]+\.ts$/;

function pageRenderers(program) {
  return new Set(
    program.body
      .filter(
        (statement) =>
          statement.type === 'ImportDeclaration' &&
          statement.importKind !== 'type' &&
          typeof statement.source.value === 'string' &&
          presenterModule.test(statement.source.value),
      )
      .flatMap((statement) => statement.specifiers)
      .filter(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind !== 'type',
      )
      .map((specifier) => specifier.local.name),
  );
}

function pageSendArgument(handler) {
  const call = handlerCall(handler);
  const reply = parameterName(handler.params[1]);
  if (
    !call ||
    !reply ||
    call.callee.type !== 'MemberExpression' ||
    call.callee.computed ||
    memberName(call.callee) !== 'send' ||
    call.arguments.length !== 1
  )
    return undefined;
  let chain = call.callee.object;
  while (chain.type === 'CallExpression') {
    const callee = chain.callee;
    if (
      callee.type !== 'MemberExpression' ||
      callee.computed ||
      !pageReplyMethods.has(memberName(callee)) ||
      chain.arguments.length === 0 ||
      !chain.arguments.every(isStringLiteral)
    )
      return undefined;
    chain = callee.object;
  }
  return chain.type === 'Identifier' && chain.name === reply
    ? call.arguments[0]
    : undefined;
}

function isPageBody(sent, renderers) {
  const argument = awaited(sent);
  if (argument?.type !== 'CallExpression') return false;
  if (isUseCaseExecute(argument.callee)) return true;
  const rendered = awaited(argument.arguments[0]);
  return (
    argument.callee.type === 'Identifier' &&
    renderers.has(argument.callee.name) &&
    argument.arguments.length === 1 &&
    rendered?.type === 'CallExpression' &&
    isUseCaseExecute(rendered.callee)
  );
}

const specSource = /\.spec\.ts$/;
const storeContractSource = /\/packages\/[^/]+\/spec\/contracts\/.+\.ts$/;
const storageSpec = /\/packages\/storage\/src\/.+\.spec\.ts$/;
const storagePublicApi =
  /\/packages\/storage\/src\/(?:index|repositories\/[^/]+\/index)\.ts$/;
const specNodeModule = /^node:(?:fs|path|os|child_process)(?:\/[a-z]+)?$/;
const statusPolicySpec = /\/apps\/server\/src\/http\/status-policy\.spec\.ts$/;
const adapterSpec = /\/apps\/server\/src\/adapters\/.+\.spec\.ts$/;
const storageEntry = /^@porcelain\/storage(?:\/[a-z-]+)?$/;
const gitCapabilityEntry =
  /^@porcelain\/git\/(?:discovery|inspection|history|actions)$/;
const specPackageEntry = new RegExp(
  `^@porcelain/(?:${domainPackage}/(?:services|rules|models|errors|store-contracts)|kernel/(?:models|rules|errors|fakes))$`,
);
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
const httpStatus =
  /(?:^|\s)[1-5]\d\d(?=\s*$|\s+(?:when|if|for|unless)\b)|^\s*[1-5]\d\d\b|\bhttp\s+(?:status|code|[1-5]\d\d)\b|\bstatus\s+code|\b(?:status|code)\s+[1-5]\d\d\b/i;
const statusNumber =
  /(?<![\w.-])(?:10[0-3]|20[0-8]|226|30[0-8]|4(?:0\d|1[0-8]|2[1-689]|31|51)|50[0-8]|51[01])(?![\w.-])(?!\s+(?:commits?|files?|bytes?|paths?|entries|lines?|threads?|items?|ms|characters?|chars?)\b)/;

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
const featureMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const routeHook = /^(?:on|pre)[A-Z]|^(?:handler|errorHandler)$/;
const pureConstructors = new Set(['Map', 'Set', 'RegExp']);
const pureCrypto = new Set(['createHash', 'timingSafeEqual']);
const primitiveTypes = new Set([
  'TSVoidKeyword',
  'TSUndefinedKeyword',
  'TSNullKeyword',
  'TSStringKeyword',
  'TSNumberKeyword',
  'TSBooleanKeyword',
  'TSBigIntKeyword',
  'TSSymbolKeyword',
  'TSNeverKeyword',
  'TSLiteralType',
  'TSTemplateLiteralType',
]);
const portName =
  /(?:Store|Reader|Writer|Runner|Source|Publisher|Watcher|Probe|Logger|^Clock)$/;
const fakeName = /^(?:InMemory|Scripted|Fixed|Sequential|Recording)[A-Z]/;
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
const pascalCase = /^[A-Z][A-Za-z0-9]*$/;
const camelCase = /^[a-z][A-Za-z0-9]*$/;
const screamingCase = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const disableDirective = /^\s*(?:eslint|oxlint)-(?:disable|enable)/;
const serverCode = /^(?:apps\/server|packages\/[^/]+)\//;
const packageCode = /^packages\/([^/]+)\/(?:src|spec)\//;
const nodeGlobalScope =
  /^(?:packages\/[^/]+\/src|apps\/server\/src\/(?:use-cases|ports))\//;
const serverSource = /^(?:packages\/[^/]+|apps\/server)\/src\//;
const serviceFile = /^packages\/[^/]+\/src\/services\//;
const ruleFile = /^packages\/[^/]+\/src\/rules\//;
const modelFile = /^packages\/[^/]+\/src\/models\//;
const portFile = /^packages\/([^/]+)\/src\/ports\//;
const anyPortFile = /^(?:packages\/[^/]+|apps\/server)\/src\/ports\//;
const runtimeFile = /^apps\/server\/src\/runtime\//;
const serverAppFile = /^apps\/server\/src\//;
const timerGlobals = new Set(['setTimeout', 'setInterval', 'setImmediate']);
const timerModule = /^(?:node:)?timers(?:\/promises)?$/;
const scopeFile = /^apps\/server\/src\/http\/scopes\/.+\.ts$/;
const fixtureFile = /^packages\/[^/]+\/spec\/fixtures\//;
const fixtureModules = new Set(['node:fs', 'node:path', 'node:url']);
const fixtureModelSource = /^\.\.\/\.\.\/src\/models\/[a-z0-9-]+\.ts$/;
const signalMembers = new Set(['throwIfAborted', 'aborted', 'onabort']);
const openTypes = new Set([
  'TSObjectKeyword',
  'TSUnknownKeyword',
  'TSAnyKeyword',
]);
const kernelTypesFile = /^packages\/kernel\/src\/(?:models|ports)\//;
const numberFreeFile = new RegExp(
  `^(?:packages/(?:${domainPackage}|kernel)/src/|packages/[^/]+/src/(?:rules|services)/|apps/server/src/(?:adapters|use-cases|jobs|ports)/)`,
);
const rootScriptFile = /^scripts\/[^/]+\.ts$/;
const arithmeticOperators = new Set(['+', '-', '*', '/', '%', '**', '<<', '|']);
const membershipMethods = new Set([
  'includes',
  'has',
  'indexOf',
  'lastIndexOf',
  'startsWith',
  'endsWith',
  'localeCompare',
]);
const useCaseFile = /^apps\/server\/src\/use-cases\/.+\.ts$/;
const adapterFile = /^apps\/server\/src\/adapters\//;
const storageRepositoryFile = /^packages\/storage\/src\/repositories\//;
const fakeFile = /^(?:packages\/[^/]+|apps\/server)\/spec\/fakes\//;
const clockFile =
  /^(?:packages\/[^/]+\/src\/rules|apps\/server\/src\/adapters)\//;
const indexFile = /^packages\/[^/]+\/src\/(?:.+\/)?index\.ts$/;
const operationFile =
  /^(?:packages\/[^/]+\/src\/services\/(?:[^/]+\/)*[^/]+-service|apps\/server\/src\/use-cases\/.+)\.ts$/;
const domainCode = new RegExp(
  `^(?:packages/${domainPackage}/src/(?:services|rules|models|ports|errors)/|packages/kernel/src/|apps/server/src/use-cases/)`,
);

function repositoryPath(context) {
  const path = normalizedFilename(context.filename);
  return path.startsWith(repositoryRoot)
    ? path.slice(repositoryRoot.length)
    : path;
}

function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return undefined;
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

function literalNumber(node, depth = 0) {
  if (!node || depth > 16) return undefined;
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'ParenthesizedExpression'
  )
    return literalNumber(node.expression, depth + 1);
  if (node.type === 'Literal')
    return typeof node.value === 'number' ? node.value : undefined;
  if (
    node.type === 'UnaryExpression' &&
    (node.operator === '-' || node.operator === '+')
  ) {
    const value = literalNumber(node.argument, depth + 1);
    return value === undefined
      ? undefined
      : node.operator === '-'
        ? -value
        : value;
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'length'
  ) {
    if (node.object.type === 'ArrayExpression')
      return node.object.elements.length;
    if (node.object.type === 'Literal' && typeof node.object.value === 'string')
      return node.object.value.length;
    return undefined;
  }
  if (
    node.type !== 'BinaryExpression' ||
    !arithmeticOperators.has(node.operator)
  )
    return undefined;
  const left = literalNumber(node.left, depth + 1);
  const right = literalNumber(node.right, depth + 1);
  if (left === undefined || right === undefined) return undefined;
  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === '*') return left * right;
  if (node.operator === '/') return left / right;
  if (node.operator === '%') return left % right;
  if (node.operator === '**') return left ** right;
  if (node.operator === '<<') return left << right;
  return left | right;
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
    return 'A rule never reaches through Reflect; call the function it needs by name.';
  if (name === 'Intl')
    return 'A rule is deterministic: Intl answers from the machine locale and time zone; the caller passes formatted text or the rule compares plain values.';
  const member = calledMember(identifier, context);
  if (name === 'Math')
    return member === undefined || member === 'random'
      ? 'A rule is deterministic: call Math functions by name, never Math.random or an alias of Math.'
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
    : 'A rule takes the current time as an ISO string from its caller; it uses Date only as Date.parse(text) or new Date(instant).';
}

function signalValue(node) {
  if (!node) return false;
  if (node.type === 'LogicalExpression') return signalValue(node.left);
  if (node.type === 'ChainExpression') return signalValue(node.expression);
  const name =
    node.type === 'Identifier'
      ? node.name
      : node.type === 'MemberExpression' && !node.computed
        ? node.property.name
        : undefined;
  return /signal$/i.test(name ?? '');
}

function within(node, container) {
  return (
    node.range[0] >= container.range[0] && node.range[1] <= container.range[1]
  );
}

function containsType(node, type, visitorKeys) {
  if (!node) return false;
  if (node.type === type) return true;
  return (visitorKeys[node.type] ?? []).some((key) => {
    const child = node[key];
    return Array.isArray(child)
      ? child.some((entry) => containsType(entry, type, visitorKeys))
      : containsType(child, type, visitorKeys);
  });
}

function isFunction(node) {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression'
  );
}

function awaited(node) {
  return node?.type === 'AwaitExpression' ? node.argument : node;
}

function isUseCaseExecuteCall(node) {
  if (node?.type !== 'CallExpression') return false;
  const path = memberPath(node.callee);
  return (
    path !== undefined &&
    path.length >= 2 &&
    path[0] !== 'this' &&
    path.at(-1) === 'execute'
  );
}

function statusArgument(node) {
  if (node?.type === 'Literal') return typeof node.value === 'number';
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.arguments.every((argument) => argument.type === 'Identifier')
  );
}

function replySent(node, reply) {
  if (!reply || node?.type !== 'CallExpression' || node.arguments.length !== 1)
    return undefined;
  const send = node.callee;
  if (
    send.type !== 'MemberExpression' ||
    send.computed ||
    send.property.type !== 'Identifier' ||
    send.property.name !== 'send' ||
    send.object.type !== 'CallExpression'
  )
    return undefined;
  const code = send.object;
  const path = memberPath(code.callee);
  return path?.length === 2 &&
    path[0] === reply &&
    path[1] === 'code' &&
    code.arguments.length === 1 &&
    statusArgument(code.arguments[0])
    ? node.arguments[0]
    : undefined;
}

function routeHandlerCall(handler) {
  if (!isFunction(handler)) return undefined;
  const reply = parameterName(handler.params[1]);
  const statements =
    handler.body.type === 'BlockStatement'
      ? handler.body.body
      : [{ type: 'ReturnStatement', argument: handler.body }];
  const [first, second] = statements;
  if (statements.length === 1 && first.type === 'ReturnStatement') {
    const returned = awaited(first.argument);
    if (isUseCaseExecuteCall(returned)) return returned;
    const sent = awaited(replySent(returned, reply));
    return isUseCaseExecuteCall(sent) ? sent : undefined;
  }
  if (
    statements.length !== 2 ||
    first.type !== 'VariableDeclaration' ||
    first.declarations.length !== 1 ||
    second.type !== 'ReturnStatement'
  )
    return undefined;
  const [declarator] = first.declarations;
  const call = awaited(declarator.init);
  const sent = replySent(second.argument, reply);
  return declarator.id.type === 'Identifier' &&
    isUseCaseExecuteCall(call) &&
    sent?.type === 'Identifier' &&
    sent.name === declarator.id.name
    ? call
    : undefined;
}

function requestValue(node, request) {
  return request !== undefined && memberPath(node)?.[0] === request;
}

function routeArgument(node, request) {
  if (requestValue(node, request)) return true;
  if (node.type !== 'ObjectExpression') return false;
  return node.properties.every((property) =>
    property.type === 'SpreadElement'
      ? requestValue(property.argument, request)
      : property.type === 'Property' &&
        property.kind === 'init' &&
        !property.computed &&
        !property.method &&
        (requestValue(property.value, request) ||
          (property.value.type === 'Literal' && property.value.value !== null)),
  );
}

function routePlugins(program) {
  return program.body.flatMap((statement) => {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : undefined;
    if (declaration?.type === 'FunctionDeclaration') return [declaration];
    if (declaration?.type !== 'VariableDeclaration') return [];
    return declaration.declarations
      .map((declarator) => declarator.init)
      .filter(isFunction);
  });
}

function routeInstances(program, sourceCode) {
  const variables = [];
  for (const plugin of routePlugins(program)) {
    const server = plugin.params[0];
    if (server?.type !== 'Identifier') continue;
    variables.push(
      ...sourceCode
        .getDeclaredVariables(plugin)
        .filter((variable) => variable.name === server.name),
    );
    const statements =
      plugin.body.type === 'BlockStatement' ? plugin.body.body : [];
    for (const inner of statements) {
      if (inner.type !== 'VariableDeclaration') continue;
      for (const declarator of inner.declarations) {
        const init = declarator.init;
        const path = memberPath(
          init?.type === 'CallExpression' ? init.callee : undefined,
        );
        if (
          declarator.id.type === 'Identifier' &&
          path?.length === 2 &&
          path[0] === server.name &&
          path[1] === 'withTypeProvider'
        )
          variables.push(...sourceCode.getDeclaredVariables(declarator));
      }
    }
  }
  return variables;
}

function isTypeProviderInit(identifier) {
  const member = identifier.parent;
  const call = member?.parent;
  return (
    member?.type === 'MemberExpression' &&
    member.object === identifier &&
    !member.computed &&
    member.property.type === 'Identifier' &&
    member.property.name === 'withTypeProvider' &&
    call?.type === 'CallExpression' &&
    call.callee === member &&
    call.parent?.type === 'VariableDeclarator' &&
    call.parent.init === call
  );
}

function discriminants(member) {
  return new Set(
    member.members
      .filter(
        (property) =>
          property.type === 'TSPropertySignature' &&
          !property.optional &&
          property.key.type === 'Identifier' &&
          property.typeAnnotation?.typeAnnotation.type === 'TSLiteralType',
      )
      .map((property) => property.key.name),
  );
}

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

function unwrapPromise(node) {
  const argument = (node?.typeArguments ?? node?.typeParameters)?.params[0];
  return node?.type === 'TSTypeReference' &&
    node.typeName.type === 'Identifier' &&
    node.typeName.name === 'Promise' &&
    argument
    ? argument
    : node;
}

function isExecuteMethod(node) {
  return (
    node.kind === 'method' &&
    !node.computed &&
    node.key.type === 'Identifier' &&
    node.key.name === 'execute'
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
  return specSource.test(path) || storeContractSource.test(path);
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

function caseTitle(node) {
  if (!caseFunctions.has(chainRoot(node.callee) ?? '')) return undefined;
  const title = node.arguments[0];
  if (title?.type === 'Literal' && typeof title.value === 'string')
    return title.value;
  if (title?.type === 'TemplateLiteral')
    return title.quasis.map((quasi) => quasi.value.cooked ?? '').join(' ');
  return undefined;
}

function allowedSpecImport(filename, source) {
  if (source === 'vitest') return true;
  if (specNodeModule.test(source) || specPackageEntry.test(source)) return true;
  const path = normalizedFilename(filename);
  if (statusPolicySpec.test(path) && gitCapabilityEntry.test(source))
    return true;
  if (adapterSpec.test(path) && storageEntry.test(source)) return true;
  if (!source.startsWith('.')) return false;
  const unit = path.split('/').at(-1).replace(specSource, '.ts');
  if (source === `./${unit}`) return true;
  const target = new URL(
    source,
    `file://${path.startsWith('/') ? '' : '/'}${path}`,
  ).pathname;
  if (storageSpec.test(path)) return storagePublicApi.test(target);
  if (storeContractSource.test(path))
    return (
      /\/src\/(?:ports|models|errors)\/[^/]+\.ts$/.test(target) ||
      /\/spec\/contracts\/[^/]+\.ts$/.test(target)
    );
  return /\/spec\/(?:fakes|fixtures|contracts)\/.+\.ts$/.test(target);
}

export default {
  meta: { name: 'porcelain' },
  rules: {
    'operation-class-members': {
      create(context) {
        if (!operationFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const check = (node) => {
          if (node.superClass)
            context.report({
              node: node.superClass,
              message:
                'An operation class extends nothing; inherited members escape the class shape.',
            });
          if (
            node.type === 'ClassExpression' ||
            node.parent?.type !== 'ExportNamedDeclaration'
          )
            context.report({
              node,
              message:
                'An operation file declares only its exported class; move other classes into their own module.',
            });
          for (const member of node.body.body) {
            if (member.type === 'StaticBlock')
              context.report({
                node: member,
                message: 'An operation class has no static initialisation.',
              });
            const value =
              member.type === 'PropertyDefinition' ||
              member.type === 'AccessorProperty'
                ? member.value
                : undefined;
            if (
              isFunction(value) ||
              (value?.type === 'CallExpression' &&
                memberPath(value.callee)?.at(-1) === 'bind')
            )
              context.report({
                node: member,
                message:
                  'Write a private method instead of a function-valued field.',
              });
          }
        };
        return { ClassDeclaration: check, ClassExpression: check };
      },
    },
    'feature-route-registrations': {
      create(context) {
        if (!routeSource.test(normalizedFilename(context.filename))) return {};
        return {
          Program(program) {
            let registrations = 0;
            for (const variable of routeInstances(program, context.sourceCode))
              for (const reference of variable.references) {
                const identifier = reference.identifier;
                if (reference.init || identifier === variable.identifiers[0])
                  continue;
                if (isTypeProviderInit(identifier)) continue;
                const member = identifier.parent;
                const call = member?.parent;
                if (
                  member?.type !== 'MemberExpression' ||
                  member.object !== identifier ||
                  call?.type !== 'CallExpression' ||
                  call.callee !== member
                ) {
                  context.report({
                    node: identifier,
                    message:
                      'Use the server instance only to register the route; never alias it or pass it on.',
                  });
                  continue;
                }
                const method = propertyName(member, context);
                if (!featureMethods.has(method ?? '')) {
                  context.report({
                    node: member,
                    message:
                      'A feature route calls only get, post, put, patch or delete on the server instance; no hooks, plugins or computed methods.',
                  });
                  continue;
                }
                registrations += 1;
                if (registrations > 1)
                  context.report({
                    node: call,
                    message: 'A feature route file registers one endpoint.',
                  });
                if (call.arguments.length !== 3)
                  context.report({
                    node: call,
                    message:
                      'Register a feature route as (path, options, handler).',
                  });
                const options = call.arguments[1];
                if (options?.type !== 'ObjectExpression') {
                  context.report({
                    node: options ?? call,
                    message: 'Route options are an object literal.',
                  });
                  continue;
                }
                for (const property of options.properties)
                  if (
                    property.type !== 'Property' ||
                    routeHook.test(propertyName(property, context) ?? '')
                  )
                    context.report({
                      node: property,
                      message:
                        'Declare no route-level hooks or handlers; access and caching live in the scope.',
                    });
              }
          },
        };
      },
    },
    'mcp-tool-handler': {
      create(context) {
        if (!mcpSource.test(normalizedFilename(context.filename))) return {};
        const handlers = [];
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (
              callee.type === 'MemberExpression' &&
              propertyName(callee, context) === 'registerTool'
            ) {
              const handler = node.arguments[2];
              if (!isFunction(handler)) {
                context.report({
                  node,
                  message: 'Register an MCP tool as (name, options, handler).',
                });
                return;
              }
              handlers.push({ node, handler, executes: 0 });
              return;
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
                  'An MCP tool handler calls only execute on its use case.',
              });
          },
          'CallExpression:exit'(node) {
            const index = handlers.findIndex((entry) => entry.node === node);
            if (index === -1) return;
            const [entry] = handlers.splice(index, 1);
            if (entry.executes !== 1)
              context.report({
                node: entry.handler,
                message:
                  'An MCP tool handler calls one use case once; a sequence of use cases belongs in one use case.',
              });
          },
        };
      },
    },
    'feature-route-handler': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!routeSource.test(path) || pageSource.test(path)) return {};
        const statusFunctions = new Set();
        return {
          ImportDeclaration(node) {
            if (!/(?:^|\/)status-policy\.ts$/.test(node.source.value)) return;
            for (const specifier of node.specifiers)
              if (specifier.type === 'ImportSpecifier')
                statusFunctions.add(specifier.local.name);
          },
          'CallExpression:exit'(node) {
            const argument = node.arguments[0];
            if (
              node.callee.type === 'MemberExpression' &&
              propertyName(node.callee, context) === 'code' &&
              argument?.type === 'CallExpression' &&
              (argument.callee.type !== 'Identifier' ||
                !statusFunctions.has(argument.callee.name))
            )
              context.report({
                node: argument,
                message:
                  'A route decides no status; reply.code takes a literal or a function imported from status-policy.ts.',
              });
          },
          CallExpression(node) {
            const callee = node.callee;
            if (
              callee.type !== 'MemberExpression' ||
              !featureMethods.has(propertyName(callee, context) ?? '') ||
              !isFunction(node.arguments[2])
            )
              return;
            const handler = node.arguments[2];
            const call = routeHandlerCall(handler);
            if (!call) {
              context.report({
                node: handler,
                message:
                  'The handler body is one use-case execute call, optionally wrapped in reply.code(status).send(result).',
              });
              return;
            }
            const request = parameterName(handler.params[0]);
            for (const argument of call.arguments)
              if (!routeArgument(argument, request))
                context.report({
                  node: argument,
                  message:
                    'Pass the use case request values and literals only; no callbacks, calls or logic in a route.',
                });
          },
        };
      },
    },
    'no-schema-parse-aliases': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (
          !useCaseSource.test(path) &&
          !typedPackageSource.test(path) &&
          !useCaseFile.test(repositoryPath(context))
        )
          return {};
        const message =
          'Typed code trusts its input; parse, safeParse, decode and safeDecode run at the transport boundary, under any name.';
        const trusted = (node) =>
          node?.type === 'Identifier' && trustedParsers.has(node.name);
        return {
          MemberExpression(node) {
            const name = propertyName(node, context);
            if (!aliasedParseMethods.has(name ?? '') || trusted(node.object))
              return;
            if (
              node.parent?.type === 'CallExpression' &&
              node.parent.callee === node &&
              parseMethods.has(memberName(node) ?? '')
            )
              return;
            context.report({ node, message });
          },
          ObjectPattern(node) {
            const declarator =
              node.parent?.type === 'VariableDeclarator' &&
              node.parent.id === node
                ? node.parent
                : undefined;
            if (trusted(declarator?.init)) return;
            for (const property of node.properties) {
              if (property.type !== 'Property') continue;
              const name = propertyName(property, context);
              if (!aliasedParseMethods.has(name ?? '')) continue;
              if (
                declarator &&
                !property.computed &&
                property.key.type === 'Identifier' &&
                parseMethods.has(name)
              )
                continue;
              context.report({ node: property, message });
            }
          },
          CallExpression(node) {
            const path = memberPath(node.callee);
            if (
              path?.[0] === 'Reflect' &&
              aliasedParseMethods.has(
                staticString(node.arguments[1], context) ?? '',
              )
            )
              context.report({ node, message });
          },
        };
      },
    },
    'no-loose-equality-in-domain': {
      create(context) {
        if (!domainCode.test(repositoryPath(context)) || isSpec(context))
          return {};
        return {
          BinaryExpression(node) {
            if (node.operator === '==' || node.operator === '!=')
              context.report({
                node,
                message:
                  'Compare with === or !==; loose equality lets null pass as absence.',
              });
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
                message: `${identifier.name} is Node; reach it through a port that a gateway, repository or server adapter implements.`,
              });
          },
        };
      },
    },
    'no-disable-directives': {
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments())
              if (disableDirective.test(comment.value))
                context.report({
                  loc: comment.loc,
                  message:
                    'Fix the code instead of disabling a rule; disable directives are not allowed.',
                });
          },
        };
      },
    },
    'no-void-statement': {
      create(context) {
        return {
          ExpressionStatement(node) {
            const expression = node.expression;
            if (
              expression.type === 'UnaryExpression' &&
              expression.operator === 'void' &&
              expression.argument.type === 'Identifier'
            )
              context.report({
                node,
                message:
                  'Remove the parameter instead of voiding it; execute takes no input when there is none.',
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
                'An adapter wraps Git, files, storage or a model provider; it never calls a domain service. The use case sequences domains.',
            });
          const target = /^@porcelain\/([^/]+)/.exec(source)?.[1];
          if (port && target && target !== port[1] && target !== 'kernel')
            context.report({
              node: node.source,
              message:
                'A port names only its own domain and @porcelain/kernel; another domain is read through its services in the use case.',
            });
        });
      },
    },
    'scope-shape': {
      create(context) {
        if (!scopeFile.test(repositoryPath(context))) return {};
        return {
          Program(program) {
            for (const plugin of routePlugins(program)) {
              const server = plugin.params[0];
              if (server?.type !== 'Identifier') continue;
              for (const variable of context.sourceCode
                .getDeclaredVariables(plugin)
                .filter((entry) => entry.name === server.name))
                for (const reference of variable.references) {
                  const member = reference.identifier.parent;
                  const call = member?.parent;
                  const method =
                    member?.type === 'MemberExpression' &&
                    member.object === reference.identifier
                      ? propertyName(member, context)
                      : undefined;
                  if (
                    call?.type === 'CallExpression' &&
                    call.callee === member &&
                    (method === 'register' || method === 'addHook')
                  )
                    continue;
                  context.report({
                    node: reference.identifier,
                    message:
                      'A scope only registers routes and adds hooks; an endpoint lives in http/routes/<feature>/<operation>.ts with a schema and a use case.',
                  });
                }
            }
          },
        };
      },
    },
    'interfaces-only-in-ports': {
      create(context) {
        const path = repositoryPath(context);
        if (!serverCode.test(path) || anyPortFile.test(path)) return {};
        return {
          TSInterfaceDeclaration(node) {
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
                'Write a type alias; an interface is a port and lives in ports/.',
            });
          },
        };
      },
    },
    'adapters-report-facts': {
      create(context) {
        if (!adapterFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const gitDirectory = (node) =>
          staticString(node, context)?.toLowerCase() === '.git';
        const message =
          'An adapter reports every entry; whether .git is shown is a domain rule the service applies.';
        return {
          BinaryExpression(node) {
            if (
              ['===', '!==', '==', '!='].includes(node.operator) &&
              (gitDirectory(node.left) || gitDirectory(node.right))
            )
              context.report({ node, message });
          },
          ArrayExpression(node) {
            if (node.elements.some(gitDirectory))
              context.report({ node, message });
          },
          SwitchCase(node) {
            if (gitDirectory(node.test)) context.report({ node, message });
          },
          VariableDeclarator(node) {
            if (gitDirectory(node.init)) context.report({ node, message });
          },
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              membershipMethods.has(propertyName(node.callee, context) ?? '') &&
              (gitDirectory(node.callee.object) ||
                node.arguments.some(gitDirectory))
            )
              context.report({ node, message });
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
          const target = source.startsWith('.')
            ? posix.join(posix.dirname(path), source)
            : source;
          if (target.startsWith('packages/'))
            context.report({
              node: node.source ?? node,
              message:
                'A root script imports node, libraries, other scripts, architecture/ and the server app only; a package is reached through the server or its package name, never by a path into packages/.',
            });
        });
      },
    },
    'no-interface-in-runtime': {
      create(context) {
        if (!runtimeFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        return {
          TSInterfaceDeclaration(node) {
            context.report({
              node,
              message:
                'runtime/ implements the lanes; a contract the server depends on is a port in apps/server/src/ports/.',
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
          'A schedule lives in apps/server/src/runtime: repeating work is an IntervalJob, a wait is a runtime helper; setTimeout and setInterval appear nowhere else.';
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
        if (!fixtureFile.test(repositoryPath(context))) return {};
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
              'A fixture reads captured output with node:fs, node:path and node:url, and imports only types from its own package models.',
          });
        });
      },
    },
    'events-after-lane': {
      create(context) {
        if (!useCaseFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const lanes = [];
        const isLaneRun = (node) =>
          node.callee.type === 'MemberExpression' &&
          propertyName(node.callee, context) === 'run' &&
          memberPath(node.callee.object)?.at(-1) === 'lanes';
        return {
          CallExpression(node) {
            if (isLaneRun(node)) {
              lanes.push(node);
              return;
            }
            const path = memberPath(node.callee);
            if (
              path?.[0] === 'this' &&
              path[1] === 'events' &&
              lanes.some((lane) =>
                lane.arguments.slice(2, 3).some((work) => within(node, work)),
              )
            )
              context.report({
                node,
                message:
                  'Publish after the lane settles: return whether anything changed from the lane and publish outside it.',
              });
          },
          'CallExpression:exit'(node) {
            if (lanes.at(-1) === node) lanes.pop();
          },
        };
      },
    },
    'lane-after-check': {
      create(context) {
        if (!useCaseFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const methods = [];
        const calls = (node, owner, method) => {
          const path = memberPath(node.callee);
          return (
            path?.length === 3 &&
            path[0] === 'this' &&
            path[1] === owner &&
            (method === undefined || path[2] === method)
          );
        };
        return {
          MethodDefinition() {
            methods.push({ checks: [], keys: [] });
          },
          CallExpression(node) {
            const method = methods.at(-1);
            if (!method) return;
            if (calls(node, 'checkWorktree', 'execute'))
              method.checks.push(node);
            else if (calls(node, 'laneKeys')) method.keys.push(node);
          },
          'MethodDefinition:exit'() {
            const method = methods.pop();
            if (!method || method.checks.length === 0) return;
            const first = Math.min(
              ...method.checks.map((check) => check.range[0]),
            );
            for (const key of method.keys)
              if (key.range[0] < first)
                context.report({
                  node: key,
                  message:
                    'Resolve the worktree with checkWorktree before choosing its lane; the lane is a property of the resolved worktree.',
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
                'A rule is pure: from node it imports only createHash and timingSafeEqual from node:crypto.',
            });
        };
        return {
          ...moduleVisitors(checkModule),
          ThrowStatement(node) {
            context.report({
              node,
              message:
                'A rule returns a value or an outcome; the service decides to throw.',
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
                  'A rule constructs only Map, Set, RegExp and a Date from one given instant; errors, the current time and buffers belong in services and adapters.',
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
                  'A rule returns a value or an outcome; it never builds an error, with or without new.',
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
                  'Import a module by a literal path; a computed import() hides a dependency from arch:check.',
              });
          },
        };
      },
    },
    'kernel-is-types': {
      create(context) {
        if (!kernelTypesFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const report = (node) =>
          context.report({
            node,
            message:
              'Kernel models and ports hold types only; a pure function belongs in kernel rules/, an error class in kernel errors/, anything else in a domain.',
          });
        return {
          FunctionDeclaration: report,
          FunctionExpression: report,
          ArrowFunctionExpression: report,
          ClassDeclaration: report,
          ClassExpression: report,
          VariableDeclaration: report,
          TSEnumDeclaration: report,
        };
      },
    },
    'models-file-shape': {
      create(context) {
        if (!modelFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const aliases = new Map();
        const resolved = (node) =>
          node.type === 'TSTypeReference' &&
          node.typeName.type === 'Identifier' &&
          aliases.has(node.typeName.name)
            ? aliases.get(node.typeName.name)
            : node;
        return {
          Program(program) {
            for (const statement of program.body) {
              const declaration =
                statement.type === 'ExportNamedDeclaration'
                  ? statement.declaration
                  : statement;
              if (declaration?.type === 'TSTypeAliasDeclaration')
                aliases.set(declaration.id.name, declaration.typeAnnotation);
            }
          },
          TSInterfaceDeclaration(node) {
            context.report({
              node,
              message: 'Write a model as a type alias, never an interface.',
            });
          },
          TSPropertySignature(node) {
            if (!node.optional) return;
            const annotation = node.typeAnnotation?.typeAnnotation;
            if (
              annotation?.type !== 'TSUnionType' ||
              !annotation.types.some(
                (member) => member.type === 'TSUndefinedKeyword',
              )
            )
              context.report({
                node,
                message: 'Write an optional property as ?: T | undefined.',
              });
          },
          TSTypeAliasDeclaration(node) {
            if (!/Result$/.test(node.id.name)) return;
            const annotation = node.typeAnnotation;
            const members =
              annotation.type === 'TSUnionType'
                ? annotation.types
                : [annotation];
            if (members.every((member) => primitiveTypes.has(member.type)))
              context.report({
                node,
                message: `${node.id.name} is an object or a domain type; a service with nothing to return returns void and names no Result.`,
              });
          },
          TSUnionType(node) {
            const members = node.types.map(resolved);
            if (
              members.length < 2 ||
              !members.every((member) => member.type === 'TSTypeLiteral')
            )
              return;
            const [first, ...rest] = members.map(discriminants);
            const shared = [...first].filter((key) =>
              rest.every((keys) => keys.has(key)),
            );
            if (shared.length > 0 && !shared.includes('kind'))
              context.report({
                node,
                message: `Discriminate the union on kind, not ${shared.join(' or ')}.`,
              });
          },
        };
      },
    },
    'no-inline-execute-types': {
      create(context) {
        const path = repositoryPath(context);
        if (
          (!serviceFile.test(path) && !useCaseFile.test(path)) ||
          isSpec(context)
        )
          return {};
        return {
          MethodDefinition(node) {
            if (!isExecuteMethod(node)) return;
            const annotations = [
              ...node.value.params.map((parameter) =>
                parameter.type === 'TSParameterProperty'
                  ? parameter.parameter.typeAnnotation
                  : parameter.typeAnnotation,
              ),
              node.value.returnType,
            ];
            for (const annotation of annotations)
              if (
                containsType(
                  annotation,
                  'TSTypeLiteral',
                  context.sourceCode.visitorKeys,
                )
              )
                context.report({
                  node: annotation,
                  message:
                    'Name the execute input and result in models/<operation>.ts instead of an inline object type.',
                });
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
                  'Time comes from the Clock port as an ISO string; Date arithmetic lives in rules/ and adapters/ only.',
              });
          },
        };
      },
    },
    'no-undefined-union-result': {
      create(context) {
        if (!serviceFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        return {
          MethodDefinition(node) {
            if (!isExecuteMethod(node)) return;
            const result = unwrapPromise(node.value.returnType?.typeAnnotation);
            if (
              result?.type === 'TSUnionType' &&
              result.types.some(
                (member) =>
                  member.type === 'TSUndefinedKeyword' ||
                  member.type === 'TSVoidKeyword',
              )
            )
              context.report({
                node: result,
                message:
                  'Return a named outcome or throw the named error; execute never answers T | undefined.',
              });
          },
        };
      },
    },
    'signals-are-passed': {
      create(context) {
        const path = repositoryPath(context);
        if (
          (!serviceFile.test(path) && !useCaseFile.test(path)) ||
          isSpec(context)
        )
          return {};
        const message =
          'Pass the signal to the port and never inspect it; an abort propagates as an error.';
        const inspects = (name, owner) =>
          signalMembers.has(name ?? '') ||
          (name === 'reason' && signalValue(owner));
        return {
          MemberExpression(node) {
            if (inspects(propertyName(node, context), node.object))
              context.report({ node, message });
          },
          ObjectPattern(node) {
            const owner =
              node.parent?.type === 'VariableDeclarator'
                ? node.parent.init
                : node.parent?.type === 'AssignmentPattern'
                  ? node.parent.right
                  : undefined;
            const parameter =
              node.parent?.type === 'AssignmentPattern'
                ? node.parent.parent
                : node.parent;
            const fromSignal =
              signalValue(owner) ||
              (isFunction(parameter) && parameter.params.includes(node));
            for (const property of node.properties)
              if (
                property.type === 'Property' &&
                (signalMembers.has(propertyName(property, context) ?? '') ||
                  (fromSignal && propertyName(property, context) === 'reason'))
              )
                context.report({ node: property, message });
          },
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              propertyName(node.callee, context) === 'addEventListener' &&
              staticString(node.arguments[0], context) === 'abort'
            )
              context.report({ node, message });
            if (
              memberPath(node.callee)?.[0] === 'Reflect' &&
              inspects(
                staticString(node.arguments[1], context),
                node.arguments[0],
              )
            )
              context.report({ node, message });
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
                  'Inside a package, import a file by its relative path, never the package by name.',
              });
            if (
              source.startsWith('.') &&
              /(?:^|\/)index\.ts$/.test(source) &&
              !importsAnotherGitCapability(path, source)
            )
              context.report({
                node: node.source,
                message:
                  'Import the file itself; an index.ts exists for package.json exports only.',
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
                  message: 'An index.ts holds export ... from statements only.',
                });
          },
        };
      },
    },
    'port-shape': {
      create(context) {
        const path = repositoryPath(context);
        if (!anyPortFile.test(path) || indexFile.test(path) || isSpec(context))
          return {};
        const visitorKeys = context.sourceCode.visitorKeys;
        const checkParameters = (node, parameters, returned) => {
          const names = parameters.map(parameterName);
          if (
            parameters.length > 2 ||
            (parameters.length >= 1 && names[0] !== 'input') ||
            (parameters.length === 2 && names[1] !== 'signal')
          )
            context.report({
              node,
              message:
                'A port method takes (), (input) or (input, signal): one input object, then the signal.',
            });
          const input = parameters[0]?.typeAnnotation?.typeAnnotation;
          if (input && input.type !== 'TSTypeReference')
            context.report({
              node: input,
              message:
                'A port input is a named model from models/ or the kernel, never an inline or primitive type.',
            });
          if (containsType(returned, 'TSTypeLiteral', visitorKeys))
            context.report({
              node: returned,
              message:
                'A port answers a named model from its own models/ or the kernel; an inline shape copies another domain unseen.',
            });
        };
        return {
          TSInterfaceDeclaration(node) {
            if (!portName.test(node.id.name))
              context.report({
                node: node.id,
                message:
                  'Name a port for its role: it ends in Store, Reader, Writer, Runner, Source, Publisher, Watcher, Probe or Logger, or it is Clock.',
              });
            for (const member of node.body.body) {
              if (member.type === 'TSMethodSignature')
                checkParameters(
                  member,
                  member.params,
                  member.returnType?.typeAnnotation,
                );
              const annotation = member.typeAnnotation?.typeAnnotation;
              if (
                member.type === 'TSPropertySignature' &&
                annotation?.type === 'TSFunctionType'
              )
                checkParameters(
                  member,
                  annotation.params,
                  annotation.returnType?.typeAnnotation,
                );
            }
          },
        };
      },
    },
    'no-exported-constants': {
      create(context) {
        const path = repositoryPath(context);
        const service = serviceFile.test(path);
        if ((!service && !ruleFile.test(path)) || isSpec(context)) return {};
        const message =
          'A limit arrives as a typed option from config through compose; rules and services export no constants.';
        const constants = new Set();
        return {
          Program(program) {
            for (const statement of program.body) {
              const declaration =
                statement.type === 'ExportNamedDeclaration'
                  ? statement.declaration
                  : statement;
              if (declaration?.type === 'VariableDeclaration')
                for (const declarator of declaration.declarations)
                  if (declarator.id.type === 'Identifier')
                    constants.add(declarator.id.name);
            }
          },
          ExportNamedDeclaration(node) {
            if (node.declaration?.type === 'VariableDeclaration')
              context.report({ node, message });
            if (node.source) return;
            for (const specifier of node.specifiers)
              if (
                specifier.local.type === 'Identifier' &&
                constants.has(specifier.local.name)
              )
                context.report({ node: specifier, message });
          },
          Literal(node) {
            if (
              service &&
              typeof node.value === 'number' &&
              node.value > 1 &&
              node.parent?.type !== 'TSLiteralType'
            )
              context.report({
                node,
                message:
                  'A service takes its numbers as options from config; no numeric literal above 1.',
              });
          },
        };
      },
    },
    'no-number-outside-limits': {
      create(context) {
        const path = repositoryPath(context);
        if (!numberFreeFile.test(path) || isSpec(context)) return {};
        const message =
          'A number above 1 is a limit: it lives in contracts/shared/limits.ts or config/limits.ts and arrives as a parameter or an option.';
        const hiddenNumber = (node) => {
          const text = staticString(node, context);
          return text !== undefined && Number(text) > 1;
        };
        const computed = (node) => {
          const parent = node.parent;
          if (
            parent &&
            (parent.type === 'BinaryExpression' ||
              parent.type === 'ParenthesizedExpression' ||
              parent.type === 'UnaryExpression') &&
            literalNumber(parent) !== undefined
          )
            return;
          const value = literalNumber(node);
          if (value !== undefined && value > 1)
            context.report({ node, message });
        };
        return {
          BinaryExpression: computed,
          'MemberExpression[property.name="length"]': computed,
          CallExpression(node) {
            const callee = memberPath(node.callee)?.join('.');
            if (
              [
                'Number',
                'parseInt',
                'parseFloat',
                'Number.parseInt',
                'Number.parseFloat',
              ].includes(callee ?? '') &&
              hiddenNumber(node.arguments[0])
            )
              context.report({ node, message });
          },
          UnaryExpression(node) {
            if (
              (node.operator === '+' || node.operator === '-') &&
              hiddenNumber(node.argument)
            )
              context.report({ node, message });
          },
          Literal(node) {
            if (
              typeof node.value === 'number' &&
              node.value > 1 &&
              node.parent?.type !== 'TSLiteralType'
            )
              context.report({
                node,
                message:
                  'A number above 1 is a limit: it lives in contracts/shared/limits.ts or config/limits.ts and arrives as a parameter or an option.',
              });
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
              message: 'Name a class in PascalCase.',
            });
          if (fake && !fakeName.test(name))
            context.report({
              node: node.id,
              message:
                'Name a fake InMemory<Port>, Scripted<Port>, Fixed<Port> or Sequential<Port>; Recording<Port> only for a port that answers nothing back.',
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
                'Name a field in camelCase after its type, without the Service or Store suffix.',
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
                      'Name a top-level constant of a primitive in SCREAMING_CASE.',
                  });
            }
          },
        };
      },
    },
    'implementation-name': {
      create(context) {
        const path = repositoryPath(context);
        if (
          (!adapterFile.test(path) && !storageRepositoryFile.test(path)) ||
          isSpec(context)
        )
          return {};
        return {
          ClassDeclaration(node) {
            const implemented = node.implements ?? [];
            if (implemented.length !== 1) {
              context.report({
                node: node.id ?? node,
                message:
                  'An implementation class implements exactly one port interface.',
              });
              return;
            }
            const expression = implemented[0].expression;
            const port =
              expression.type === 'Identifier'
                ? expression.name
                : expression.right?.name;
            if (port && !node.id?.name.endsWith(port))
              context.report({
                node: node.id ?? node,
                message: `Name the class for its technology followed by the port: <Technology>${port}.`,
              });
          },
        };
      },
    },
    'bootstrap-starts-nothing': {
      create(context) {
        if (!composeSource.test(normalizedFilename(context.filename)))
          return {};
        const message =
          'Composition builds objects only; defaults belong in config, starting and running in runtime and jobs.';
        return {
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
          'A fake stores and returns; a decision belongs in rules/ and the port gets simpler.';
        const recording =
          'A fake stores state, it never records calls; assert through what the port reads back, or name it Recording<Port> when the port answers nothing back.';
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
                'A fake stores and returns; &&, || and ?? that choose whether something is stored are an if, and a decision belongs in rules/.',
              );
          },
          ThrowStatement(node) {
            report(
              node,
              'A fake never throws; script the outcome through what the port returns.',
            );
          },
          AssignmentExpression(node) {
            if (['&&=', '||=', '??='].includes(node.operator)) decides(node);
            if (!onField(node.left)) return;
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
                'A fake keeps its state private and readonly; seed it through the constructor and read it back through the port.',
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
                'A fake stores and returns; a filter that decides whether to store is an if. Keep the change as its own stored state and compose it when the port reads.',
              );
            if (memberPath(node.callee)?.join('.') === 'Promise.reject')
              report(
                node,
                'A fake never rejects; script the outcome through what the port returns.',
              );
          },
        };
      },
    },
    'spec-no-mocking': {
      create(context) {
        if (!isSpec(context)) return {};
        return {
          ImportExpression(node) {
            if (moduleSource(node) === 'vitest')
              context.report({
                node,
                message:
                  'Import describe, it and expect statically by name; vitest is never loaded dynamically.',
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
                    'Import describe, it and expect by name; replace vi with an in-memory fake typed by the port.',
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
                  'Replace vi with an in-memory fake typed by the port, or a Clock or IdSource fake.',
              });
              return;
            }
            const matcher = memberName(node) ?? '';
            if (interactionMatchers.has(matcher) || spyMatcher.test(matcher))
              context.report({
                node: node.property,
                message:
                  'Assert on the result, on state read back through a port, or on the thrown error class.',
              });
          },
        };
      },
    },
    'spec-no-skips': {
      create(context) {
        if (!isSpec(context)) return {};
        const message =
          'Every spec runs every time; remove the skip, only, todo or fails.';
        return {
          MemberExpression(node) {
            const testMember = testFunctions.has(chainRoot(node) ?? '');
            if (testMember && node.computed && memberName(node) === undefined) {
              context.report({
                node: node.property,
                message:
                  'Call describe, it and test by their names; a computed member hides a skip.',
              });
              return;
            }
            if (
              (skippingModifiers.has(memberName(node) ?? '') && testMember) ||
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
                    'One case per behaviour: turn the loop into it.each with a sentence title per row.',
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
        if (!isSpec(context)) return {};
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
          CallExpression(node) {
            if (
              caseFunctions.has(chainRoot(node.callee) ?? '') &&
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
                  'Register every case as a statement of its describe; a case inside a condition, loop or helper may never run.',
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
                  'Name the matcher: expect(actual) asserts nothing until a matcher such as toEqual is called on it.',
              });
            for (const ancestor of context.sourceCode
              .getAncestors(node)
              .reverse()) {
              if (!isFunction(ancestor)) continue;
              const call = ancestor.parent;
              if (
                call?.type === 'CallExpression' &&
                caseFunctions.has(chainRoot(call.callee) ?? '')
              )
                return;
              if (
                call?.type === 'CallExpression' &&
                call.callee.type === 'MemberExpression' &&
                call.arguments.includes(ancestor)
              ) {
                context.report({
                  node,
                  message:
                    'Assert in the case body, not inside a callback; an expect in map, filter or forEach runs once per element, and not at all for none.',
                });
                return;
              }
            }
          },
        };
      },
    },
    'spec-behaviour-names': {
      create(context) {
        if (!isSpec(context)) return {};
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'expect' &&
              node.arguments[0]?.type === 'Literal' &&
              typeof node.arguments[0].value === 'boolean'
            ) {
              context.report({
                node,
                message:
                  'Assert on an observable result instead of a boolean literal.',
              });
              return;
            }
            const title = caseTitle(node);
            if (title === undefined) return;
            if (/^\s*should\b/i.test(title))
              context.report({
                node: node.arguments[0],
                message:
                  'Name the case as a sentence of behaviour, not with "should".',
              });
            if (httpStatus.test(title) || statusNumber.test(title))
              context.report({
                node: node.arguments[0],
                message:
                  'Name the behaviour, not the HTTP status code; statuses belong to feature verification.',
              });
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
                message: 'A spec imports its modules statically.',
              });
            return;
          }
          if (!allowedSpecImport(context.filename, source))
            context.report({
              node: node.source,
              message:
                'A spec imports only vitest, its sibling unit, @porcelain/<domain>/{services,rules,models,errors,store-contracts}, @porcelain/kernel/{models,rules,errors,fakes}, node:{fs,path,os,child_process}, spec/fakes and spec/fixtures; a storage spec, and a server adapter spec that runs a store contract over storage, imports the storage public API.',
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
          'Models hold types only; behaviour belongs in rules/ and data in services.';
        return {
          FunctionDeclaration(node) {
            context.report({ node, message });
          },
          ClassDeclaration(node) {
            context.report({ node, message });
          },
          VariableDeclaration(node) {
            context.report({ node, message });
          },
          ImportDeclaration(node) {
            if (node.importKind !== 'type')
              context.report({ node, message: 'Models import types only.' });
          },
        };
      },
    },
    'bootstrap-constructs-only': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!composeSource.test(path)) return {};
        const message =
          'Composition constructs only; decisions belong in use cases and services, schedules in jobs/.';
        const report = (node) => context.report({ node, message });
        return {
          IfStatement: report,
          SwitchStatement: report,
          TryStatement: report,
          ConditionalExpression: report,
          WhileStatement: report,
          DoWhileStatement: report,
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              ['setInterval', 'setTimeout', 'setImmediate'].includes(
                node.callee.name,
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
                  'Remove the code comment; express the rule in code or architecture guidance.',
              });
          },
        };
      },
    },
    'no-null-in-domain': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!domainSource.test(path) && !useCaseSource.test(path)) return {};
        const message =
          'Use undefined for absence; null stays at the SQL and wire boundaries.';
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
        if (!useCaseSource.test(path)) return {};
        const reexport = (node) =>
          context.report({
            node,
            message:
              'Use cases export their class only; they do not re-export.',
          });
        return {
          ImportDeclaration(node) {
            const source = node.source.value;
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
              if (!typeOnlyImport(node))
                context.report({
                  node,
                  message:
                    'Use cases import services, models and contracts as types only.',
                });
              return;
            }
            if (typeof source === 'string' && useCaseValueModule.test(source))
              return;
            context.report({
              node,
              message:
                'Use cases import only @porcelain/<domain>/services, @porcelain/<domain>/models, @porcelain/kernel/models, @porcelain/contracts/<domain> as types, @porcelain/<domain or kernel>/{rules,errors}, ../../runtime/<file> and ../../ports/<file>.',
            });
          },
          ExportNamedDeclaration(node) {
            if (node.source) reexport(node);
          },
          ExportAllDeclaration: reexport,
        };
      },
    },
    'no-schema-parse-in-typed-code': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!useCaseSource.test(path) && !typedPackageSource.test(path))
          return {};
        const message =
          'Typed code trusts its input; parse untrusted data at the transport boundary.';
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== 'MemberExpression') return;
            if (!parseMethods.has(memberName(callee))) return;
            if (
              callee.object.type === 'Identifier' &&
              trustedParsers.has(callee.object.name)
            )
              return;
            context.report({ node, message });
          },
          VariableDeclarator(node) {
            if (node.id.type !== 'ObjectPattern') return;
            if (
              node.init?.type === 'Identifier' &&
              trustedParsers.has(node.init.name)
            )
              return;
            for (const property of node.id.properties)
              if (
                property.type === 'Property' &&
                property.key.type === 'Identifier' &&
                parseMethods.has(property.key.name)
              )
                context.report({ node: property, message });
          },
        };
      },
    },
    'operation-class-shape': {
      create(context) {
        const role = operationRole(context.filename);
        if (!role) return {};
        const expectedName = expectedClassName(context.filename, role);
        const roleLabel = role === 'UseCase' ? 'Use case' : role;
        const exportMessage = `Export only the ${expectedName} class and types from this file.`;
        let found = 0;
        return {
          ExportNamedDeclaration(node) {
            const declaration = node.declaration;
            if (!declaration) {
              if (node.exportKind !== 'type')
                context.report({ node, message: exportMessage });
              return;
            }
            if (
              declaration.type === 'TSTypeAliasDeclaration' ||
              declaration.type === 'TSInterfaceDeclaration'
            )
              return;
            if (declaration.type !== 'ClassDeclaration') {
              context.report({ node, message: exportMessage });
              return;
            }
            if (declaration.id?.name !== expectedName) {
              context.report({
                node: declaration,
                message: `Name the exported class ${expectedName}.`,
              });
              return;
            }
            found += 1;
            const executes = [];
            for (const member of declaration.body.body) {
              if (isPublicExecute(member)) {
                executes.push(member);
                continue;
              }
              if (
                member.type === 'MethodDefinition' &&
                member.kind === 'constructor'
              ) {
                for (const parameter of member.value.params) {
                  if (
                    parameter.type === 'TSParameterProperty' &&
                    parameter.accessibility !== 'private' &&
                    parameter.accessibility !== 'protected'
                  )
                    context.report({
                      node: parameter,
                      message: `${roleLabel} classes expose only execute; make constructor properties private.`,
                    });
                  if (
                    parameter.type === 'TSParameterProperty' &&
                    !parameter.readonly
                  )
                    context.report({
                      node: parameter,
                      message: `${roleLabel} fields are readonly; an operation holds its collaborators, never state.`,
                    });
                }
                continue;
              }
              if (
                (member.type === 'PropertyDefinition' ||
                  member.type === 'AccessorProperty') &&
                !member.readonly
              )
                context.report({
                  node: member,
                  message: `${roleLabel} fields are readonly; an operation holds its collaborators, never state.`,
                });
              if (isPrivateMember(member)) continue;
              context.report({
                node: member,
                message: `${roleLabel} classes expose only execute; make other members private.`,
              });
            }
            if (executes.length !== 1) {
              context.report({
                node: declaration,
                message: `${roleLabel} classes need one public execute method.`,
              });
              return;
            }
            const execute = executes[0];
            if (!execute.value.returnType)
              context.report({
                node: execute,
                message:
                  'Declare the execute return type so the contract is visible to TypeScript.',
              });
            const problem = executeSignatureProblem(role, execute);
            if (problem) context.report({ node: execute, message: problem });
            for (const parameter of execute.value.params)
              if (openParameterType(parameter.typeAnnotation?.typeAnnotation))
                context.report({
                  node: parameter,
                  message:
                    'Name the execute input in models/; Record<never, never>, {}, object and unknown say nothing. Drop the parameter when there is no input.',
                });
          },
          ExportDefaultDeclaration(node) {
            context.report({ node, message: exportMessage });
          },
          ExportAllDeclaration(node) {
            context.report({ node, message: exportMessage });
          },
          'Program:exit'(node) {
            if (found !== 1)
              context.report({
                node,
                message: `Export exactly one ${expectedName} class from this file.`,
              });
          },
        };
      },
    },
    'feature-route-shape': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!routeSource.test(path)) return {};
        const page = pageSource.test(path);
        let registrations = 0;
        let useCaseCalls = 0;
        let renderers = new Set();
        const contractSchemas = new Set();
        return {
          Program(node) {
            renderers = pageRenderers(node);
          },
          ImportDeclaration(node) {
            if (
              typeof node.source.value !== 'string' ||
              !node.source.value.startsWith('@porcelain/contracts/')
            )
              return;
            for (const specifier of node.specifiers)
              if (
                specifier.type === 'ImportSpecifier' &&
                specifier.imported.type === 'Identifier' &&
                /Schema$/.test(specifier.imported.name)
              )
                contractSchemas.add(specifier.local.name);
          },
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== 'MemberExpression' || callee.computed) return;
            if (isUseCaseExecute(callee)) useCaseCalls += 1;
            if (
              callee.object.type !== 'Identifier' ||
              callee.object.name !== 'api' ||
              callee.property.type !== 'Identifier' ||
              !routeMethods.has(callee.property.name)
            )
              return;
            registrations += 1;
            if (
              callee.property.name === 'route' ||
              callee.property.name === 'all'
            ) {
              context.report({
                node,
                message:
                  'Register a feature route with one HTTP method: api.get, api.post, api.put, api.patch or api.delete.',
              });
              return;
            }
            const schema = objectProperty(node.arguments[1], 'schema');
            const response = objectProperty(schema?.value, 'response');
            const requestSchemas =
              schema?.value.type === 'ObjectExpression'
                ? schema.value.properties.filter(
                    (entry) =>
                      entry.type === 'Property' &&
                      entry.key.type === 'Identifier' &&
                      requestKeys.has(entry.key.name),
                  )
                : [];
            const responseSchemas =
              response?.value.type === 'ObjectExpression'
                ? response.value.properties.filter(
                    (entry) => entry.type === 'Property',
                  )
                : [];
            const contractSchema = (entry) =>
              entry.value.type === 'Identifier' &&
              contractSchemas.has(entry.value.name);
            const handler = node.arguments[2];
            if (
              node.arguments[0]?.type !== 'Literal' ||
              typeof node.arguments[0].value !== 'string' ||
              !response ||
              response.value.type !== 'ObjectExpression' ||
              handler?.type !== 'ArrowFunctionExpression' ||
              !requestSchemas.every(contractSchema) ||
              responseSchemas.length === 0 ||
              !responseSchemas.every(contractSchema)
            )
              context.report({
                node,
                message:
                  'A feature route needs a literal path, imported contract schemas for input and output, and one arrow handler.',
              });
            if (handler?.type !== 'ArrowFunctionExpression') return;
            if (page) {
              if (!isPageBody(pageSendArgument(handler), renderers))
                context.report({
                  node: handler,
                  message:
                    'A page handler is one expression: reply, then .header or .type calls with string literals, then .send(await options.useCase.execute(...)) or .send(render(await options.useCase.execute(...))) where render is imported from http/presenters/.',
                });
              return;
            }
            const call = routeHandlerCall(handler);
            if (!call || !isUseCaseExecute(call.callee))
              context.report({
                node: handler,
                message:
                  'The handler body is one call to options.useCase.execute, returned as it is or sent with reply.code(status).send(result).',
              });
          },
          'Program:exit'(node) {
            if (registrations !== 1 || useCaseCalls !== 1)
              context.report({
                node,
                message:
                  'A feature route registers one endpoint and calls options.useCase.execute once.',
              });
          },
        };
      },
    },
  },
};
