import { existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, nodeGlobalRoles, webPart } from './policy.ts';
import { webRules } from './web-rules.mjs';
import { mobileRules } from './mobile-rules.mjs';
import { hollowTests, testSource } from './hollow-tests.mjs';

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
  /\/apps\/server\/src\/bootstrap\/(?:.+\/)?(?:compose-[^/]+|main)\.ts$/;
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
      : 'Use case execute takes (context) or (input, context); the context always comes last, because callers must pass input and cancellation consistently.';
  return rest.length <= 1 &&
    (!last || (parameterName(last) === 'signal' && last.optional))
    ? undefined
    : 'Service execute takes (), (input), (signal?) or (input, signal?), because callers must pass input and cancellation consistently.';
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
const useCasePortName = /UseCasePort$/;
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
const serviceFile = /^packages\/[^/]+\/src\/services\//;
const ruleFile = /^packages\/[^/]+\/src\/rules\//;
const modelFile = /^packages\/[^/]+\/src\/models\//;
const portFile = /^packages\/([^/]+)\/src\/ports\//;
const anyPortFile = /^(?:packages\/[^/]+|apps\/server)\/src\/ports\//;
const runtimeFile = /^apps\/server\/src\/runtime\//;
const infrastructureInterfaceFile =
  /^packages\/(?:git|agents|process)\/src\/(?:.+\/)?interfaces\/[^/]+\.ts$/;
const serverAppFile = /^apps\/server\/src\//;
const timerGlobals = new Set(['setTimeout', 'setInterval', 'setImmediate']);
const timerModule = /^(?:node:)?timers(?:\/promises)?$/;
const scopeFile = /^apps\/server\/src\/http\/scopes\/.+\.ts$/;
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
const signalMembers = new Set(['throwIfAborted', 'aborted', 'onabort']);
const openTypes = new Set([
  'TSObjectKeyword',
  'TSUnknownKeyword',
  'TSAnyKeyword',
]);
const kernelTypesFile = /^packages\/kernel\/src\/(?:models|ports)\//;
const numberFreeFile = new RegExp(
  `^(?:packages/[^/]+/src/|apps/(?:server|web|mobile)/src/)`,
);
const visualViewFile =
  /^apps\/(?:web|mobile)\/src\/(?:app|features\/[^/]+)\/views\//;
const limitsFile =
  /^(?:packages\/contracts\/src\/shared\/limits|apps\/(?:server|web|mobile)\/src\/config\/limits)\.ts$/;
const statusName = /(?:^|\.)status(?:Code)?$/i;
const positionMethods = new Set(['slice', 'at', 'substring', 'padStart']);
const FIELD_POSITION_MAX = 16;

function enclosingFunctionName(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === 'FunctionDeclaration') return current.id?.name ?? '';
    if (
      (current.type === 'ArrowFunctionExpression' ||
        current.type === 'FunctionExpression') &&
      current.parent?.type === 'VariableDeclarator'
    )
      return current.parent.id?.name ?? '';
  }
  return '';
}

function declaredName(node) {
  let current = node?.parent;
  while (current?.type === 'TSAsExpression') current = current.parent;
  return current?.type === 'VariableDeclarator' ? (current.id.name ?? '') : '';
}

function calledMethod(callee) {
  return callee.type === 'MemberExpression' ? memberName(callee) : undefined;
}

function allowedNumberContext(node, value) {
  let current = node;
  while (
    current.parent?.type === 'ConditionalExpression' ||
    current.parent?.type === 'UnaryExpression'
  )
    current = current.parent;
  const parent = current.parent;
  if (node.raw?.startsWith('0o')) return true;
  const status = value >= 100 && value <= 599;
  if (status && parent?.type === 'Property' && parent.key === current)
    return true;
  if (
    status &&
    parent?.type === 'Property' &&
    parent.value === current &&
    statusName.test(parent.key.name ?? '')
  )
    return true;
  if (
    status &&
    parent?.type === 'BinaryExpression' &&
    ['===', '!==', '>=', '<=', '>', '<'].includes(parent.operator) &&
    statusName.test(
      memberPath(parent.left === current ? parent.right : parent.left)?.join(
        '.',
      ) ?? '',
    )
  )
    return true;
  if (
    status &&
    parent?.type === 'CallExpression' &&
    parent.arguments[0] === current &&
    (calledMethod(parent.callee) === 'code' ||
      (parent.callee.type === 'Identifier' &&
        parent.callee.name === 'response'))
  )
    return true;
  if (
    status &&
    parent?.type === 'ReturnStatement' &&
    /Status$/.test(enclosingFunctionName(current))
  )
    return true;
  if (
    value >= 1000 &&
    value <= 4999 &&
    parent?.type === 'CallExpression' &&
    parent.arguments[0] === current &&
    calledMethod(parent.callee) === 'close'
  )
    return true;
  const position = value <= FIELD_POSITION_MAX;
  if (
    position &&
    parent?.type === 'MemberExpression' &&
    parent.computed &&
    parent.property === current
  )
    return true;
  if (
    parent?.type === 'CallExpression' &&
    parent.arguments[0] === current &&
    ['toString', 'charCodeAt'].includes(calledMethod(parent.callee) ?? '')
  )
    return true;
  if (
    parent?.type === 'CallExpression' &&
    parent.arguments[2] === current &&
    memberPath(parent.callee)?.join('.') === 'JSON.stringify'
  )
    return true;
  const signed =
    current.type === 'UnaryExpression' && current.operator === '-'
      ? -value
      : value;
  if (
    node.raw?.startsWith('0x') &&
    parent?.type === 'BinaryExpression' &&
    /code$/i.test(
      (parent.left === current ? parent.right : parent.left).name ?? '',
    )
  )
    return true;
  if (
    signed >= -32768 &&
    signed <= -32000 &&
    parent?.type === 'Property' &&
    parent.value === current &&
    parent.key.name === 'code'
  )
    return true;
  if (
    parent?.type === 'Property' &&
    parent.value === current &&
    /ExitCodes$/.test(declaredName(parent.parent))
  )
    return true;
  if (
    position &&
    ((parent?.type === 'AssignmentExpression' &&
      /index$/i.test(parent.left.name ?? '')) ||
      (parent?.type === 'VariableDeclarator' &&
        /index$/i.test(parent.id.name ?? '')))
  )
    return true;
  return (
    position &&
    parent?.type === 'CallExpression' &&
    parent.arguments.includes(current) &&
    positionMethods.has(calledMethod(parent.callee) ?? '')
  );
}
const rootScriptFile = /^scripts\/[^/]+\.ts$/;
const evaluatingFile =
  /^(?:scripts\/|\.agents\/skills\/|apps\/[^/]+\/spec\/|packages\/[^/]+\/spec\/)|\.spec\.tsx?$/;
const evaluationMethods = new Set([
  'evaluate',
  'evaluateHandle',
  'waitForFunction',
]);
const arithmeticOperators = new Set(['+', '-', '*', '/', '%', '**', '<<', '|']);
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

const laneCallbackIndex = new Map([
  ['run', 2],
  ['runConsistent', 2],
  ['background', 1],
  ['finish', 0],
]);

function laneCallback(node) {
  if (node?.type !== 'CallExpression') return undefined;
  const path = memberPath(node.callee);
  if (path?.length !== 3 || path[0] !== 'this' || path[1] !== 'lanes')
    return undefined;
  const index = laneCallbackIndex.get(path[2]);
  return index === undefined ? undefined : node.arguments[index];
}

const liveProgressPublishers = new Map([
  ['RunGitActionUseCase', new Set(['settle', 'progressed', 'abandon'])],
]);

const laneHolderType =
  /(?:Store|Reader|Runner|Writer|Source|Service|UseCasePort)$|^JobWork$/;

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
  return (
    specSource.test(path) ||
    storeContractSource.test(path) ||
    /packages\/client\/spec\/integration\/[a-z]+(?:-[a-z]+)*\.integration\.ts$/.test(
      path,
    )
  );
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

function allowedSpecImport(filename, source) {
  if (source === 'vitest') return true;
  if (specNodeModule.test(source) || specPackageEntry.test(source)) return true;
  const path = normalizedFilename(filename);
  if (
    /packages\/client\/spec\/integration\/[a-z]+(?:-[a-z]+)*\.integration\.ts$/.test(
      path,
    )
  )
    return (
      /^@porcelain\/client\/(?:files|changes|history|reviews|transport)(?:\/api)?$/.test(
        source,
      ) ||
      /^@porcelain\/contracts\/(?:shared|files|changes|reviews|projects)$/.test(
        source,
      ) ||
      /^@porcelain\/server\/kit\/[a-z-]+$/.test(source) ||
      source === '@tanstack/query-core' ||
      /^\.\.\/kit\/[a-z-]+\.ts$/.test(source)
    );
  const clientFeature =
    /packages\/client\/src\/features\/([^/]+)\/(?:[^/]+\.spec\.ts|(?:commands|queries)\/[^/]+\.spec\.ts)$/.exec(
      path,
    );
  if (
    clientFeature &&
    (source === `@porcelain/client/${clientFeature[1]}` ||
      source === `@porcelain/client/${clientFeature[1]}/rules` ||
      /^@porcelain\/contracts\/(?:shared|access|projects|changes|reviews|files|git-actions)$/.test(
        source,
      ))
  )
    return true;
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
    ...webRules,
    ...mobileRules,
    'operation-class-members': {
      create(context) {
        if (!operationFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const check = (node) => {
          if (node.superClass)
            context.report({
              node: node.superClass,
              message:
                'An operation class extends nothing; inherited members escape the class shape, because hidden members can bypass the operation boundary.',
            });
          if (
            node.type === 'ClassExpression' ||
            node.parent?.type !== 'ExportNamedDeclaration'
          )
            context.report({
              node,
              message:
                'An operation file declares only its exported class; move other classes into their own module, because hidden members can bypass the operation boundary.',
            });
          for (const member of node.body.body) {
            if (member.type === 'StaticBlock')
              context.report({
                node: member,
                message:
                  'An operation class has no static initialisation, because hidden members can bypass the operation boundary.',
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
                  'Write a private method instead of a function-valued field, because hidden members can bypass the operation boundary.',
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
                      'Use the server instance only to register the route; never alias it or pass it on, because extra registration logic bypasses the scope and endpoint checks.',
                  });
                  continue;
                }
                const method = propertyName(member, context);
                if (!featureMethods.has(method ?? '')) {
                  context.report({
                    node: member,
                    message:
                      'A feature route calls only get, post, put, patch or delete on the server instance; no hooks, plugins or computed methods, because extra registration logic bypasses the scope and endpoint checks.',
                  });
                  continue;
                }
                registrations += 1;
                if (registrations > 1)
                  context.report({
                    node: call,
                    message:
                      'A feature route file registers one endpoint, because extra registration logic bypasses the scope and endpoint checks.',
                  });
                if (call.arguments.length !== 3)
                  context.report({
                    node: call,
                    message:
                      'Register a feature route as (path, options, handler), because extra registration logic bypasses the scope and endpoint checks.',
                  });
                const options = call.arguments[1];
                if (options?.type !== 'ObjectExpression') {
                  context.report({
                    node: options ?? call,
                    message:
                      'Route options are an object literal, because extra registration logic bypasses the scope and endpoint checks.',
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
                        'Declare no route-level hooks or handlers; access and caching live in the scope, because extra registration logic bypasses the scope and endpoint checks.',
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
                  message:
                    'Register an MCP tool as (name, options, handler), because domain sequencing belongs to the use case shared by every transport.',
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
                  'An MCP tool handler calls only execute on its use case, because domain sequencing belongs to the use case shared by every transport.',
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
                  'An MCP tool handler calls one use case once; a sequence of use cases belongs in one use case, because domain sequencing belongs to the use case shared by every transport.',
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
                  'A route decides no status; reply.code takes a literal or a function imported from status-policy.ts, because transport decisions must follow the shared status policy.',
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
                  'The handler body is one use-case execute call, optionally wrapped in reply.code(status).send(result), because transport decisions must follow the shared status policy.',
              });
              return;
            }
            const request = parameterName(handler.params[0]);
            for (const argument of call.arguments)
              if (!routeArgument(argument, request))
                context.report({
                  node: argument,
                  message:
                    'Pass the use case request values and literals only; no callbacks, calls or logic in a route, because transport decisions must follow the shared status policy.',
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
          'Typed code trusts its input; parse, safeParse, decode and safeDecode run at the transport boundary, under any name, because the transport has already validated these contract types.';
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
                  'Compare with === or !==; loose equality lets null pass as absence, because coercion confuses null with a missing domain value.',
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
                message: `${identifier.name} is Node; reach it through a port that a gateway, repository or server adapter implements, because machine access must remain replaceable through a port.`,
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
                  'Remove the parameter instead of voiding it; execute takes no input when there is none, because discarding input hides an unused operation dependency.',
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
          if (port && target && target !== port[1] && target !== 'kernel')
            context.report({
              node: node.source,
              message:
                'A port names only its own domain and @porcelain/kernel; another domain is read through its services in the use case, because cross-domain orchestration belongs in the use case.',
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
                      'A scope only registers routes and adds hooks; an endpoint lives in http/routes/<feature>/<operation>.ts with a schema and a use case, because endpoint logic outside routes escapes contract checks.',
                  });
                }
            }
          },
        };
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
    'interfaces-hold-interfaces': {
      create(context) {
        if (!infrastructureInterfaceFile.test(repositoryPath(context)))
          return {};
        return {
          Program(program) {
            for (const statement of program.body) {
              if (statement.type === 'ImportDeclaration') continue;
              if (
                statement.type === 'ExportNamedDeclaration' &&
                ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'].includes(
                  statement.declaration?.type,
                )
              )
                continue;
              context.report({
                node: statement,
                message:
                  'An interfaces/ file of git, agents or process declares exported interfaces only; a type, a function or a value belongs in dtos/, commands/ or parsers/, because executable code in a port module bypasses its implementation owner.',
              });
            }
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
        const visitorKeys = context.sourceCode.visitorKeys;
        return {
          ClassDeclaration(node) {
            const methods = new Map(
              node.body.body
                .filter(
                  (member) =>
                    member.type === 'MethodDefinition' &&
                    member.key.type === 'Identifier',
                )
                .map((member) => [member.key.name, member]),
            );
            const exempt =
              liveProgressPublishers.get(node.id?.name ?? '') ?? new Set();
            const reported = new Set();
            const visit = (scope, seen, publishesProgress) => {
              for (const call of nodesOf(
                scope,
                visitorKeys,
                (entry) => entry.type === 'CallExpression',
              )) {
                const path = memberPath(call.callee);
                if (path?.[0] !== 'this') continue;
                if (
                  path[1] === 'events' &&
                  !publishesProgress &&
                  !reported.has(call)
                ) {
                  reported.add(call);
                  context.report({
                    node: call,
                    message:
                      'Publish after the lane settles: return whether anything changed from lanes.run, runConsistent, background or finish and publish outside it; only a running Git action publishes its progress from inside its lane, because subscribers must observe committed state rather than an in-progress write.',
                  });
                }
                const method = path.length === 2 && methods.get(path[1]);
                if (!method || seen.has(method)) continue;
                seen.add(method);
                visit(method.value, seen, exempt.has(path[1]));
              }
            };
            for (const call of nodesOf(
              node,
              visitorKeys,
              (entry) => laneCallback(entry) !== undefined,
            ))
              visit(laneCallback(call), new Set(), false);
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
        let implemented = false;
        return {
          ImportDeclaration(node) {
            if (
              typeof node.source.value === 'string' &&
              /(?:^|\/)ports\/event-publisher\.ts$/.test(node.source.value) &&
              node.specifiers.some(
                (specifier) =>
                  specifier.type === 'ImportSpecifier' &&
                  specifier.imported.type === 'Identifier' &&
                  specifier.imported.name === 'EventPublisher',
              )
            )
              imports.push(node);
          },
          TSClassImplements(node) {
            if (
              node.expression.type === 'Identifier' &&
              node.expression.name === 'EventPublisher'
            )
              implemented = true;
          },
          'Program:exit'() {
            if (implemented && adapterFile.test(path)) return;
            for (const node of imports)
              context.report({
                node,
                message:
                  'Only a use case publishes, after its lane settles and only on change; the runtime, transport and adapters announce through a use case, never through the EventPublisher directly, because one owner decides when a completed change needs an event.',
              });
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
        const path = repositoryPath(context);
        if (isSpec(context)) return {};
        const service = serviceFile.test(path);
        const useCase = useCaseFile.test(path);
        const errors =
          /^packages\/[^/]+\/src\/errors\/(?!index\.ts$)[^/]+\.ts$/.test(path);
        if (!service && !useCase && !errors) return {};
        return {
          ExportNamedDeclaration(node) {
            if (
              errors &&
              node.declaration &&
              node.declaration.type !== 'ClassDeclaration'
            )
              context.report({
                node,
                message:
                  'An errors/ file exports its one error class; the problem-to-error switch is a private failure(problem) in the service that meets the problem, because a single mapping keeps failures consistent for every caller.',
              });
          },
          ClassBody(node) {
            const failures = node.body.filter(
              (member) =>
                member.type === 'MethodDefinition' &&
                member.key.type === 'Identifier' &&
                member.key.name === 'failure',
            );
            for (const member of failures) {
              if (useCase)
                context.report({
                  node: member,
                  message:
                    'A use case maps no problem to an error; the service that meets the problem owns its one private failure(problem), because a single mapping keeps failures consistent for every caller.',
                });
              else if (member.accessibility !== 'private')
                context.report({
                  node: member,
                  message:
                    'A service keeps its problem-to-error switch private: private failure(problem), because a single mapping keeps failures consistent for every caller.',
                });
            }
            if (service && failures.length > 1)
              context.report({
                node: failures[1],
                message:
                  'A service has one failure(problem): one switch from its problems to its errors, because a single mapping keeps failures consistent for every caller.',
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
        const contractTypes = new Set();
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
          ImportDeclaration(node) {
            if (
              typeof node.source.value === 'string' &&
              node.source.value.startsWith('@porcelain/contracts/')
            )
              for (const specifier of node.specifiers)
                contractTypes.add(specifier.local.name);
          },
          MethodDefinition(node) {
            if (
              node.key.type !== 'Identifier' ||
              node.key.name !== 'execute' ||
              node.value.params.length !== 2
            )
              return;
            const annotation =
              node.value.params[0]?.typeAnnotation?.typeAnnotation;
            for (const reference of references(annotation))
              if (
                reference?.type !== 'TSTypeReference' ||
                reference.typeName.type !== 'Identifier' ||
                !contractTypes.has(reference.typeName.name)
              )
                context.report({
                  node: reference ?? node,
                  message:
                    'A use case reached from a route takes the contract types its route validated (params, query, body), intersected as the route passes them; one reached only from another use case, a hook or the runtime stands behind ports/<name>-use-case-port.ts and may take a domain model, because copying the validated input lets the transport and use case drift.',
                });
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
        const visitorKeys = context.sourceCode.visitorKeys;
        const nested = (entry) => {
          if (laneCallback(entry) !== undefined) return true;
          if (entry.type !== 'CallExpression') return false;
          const path = memberPath(entry.callee);
          return (
            path?.length === 3 &&
            path[0] === 'this' &&
            (path[1] === 'checkWorktree' || /^refresh[A-Z]/.test(path[1])) &&
            path[2] === 'execute'
          );
        };
        return {
          CallExpression(node) {
            const callback = laneCallback(node);
            if (callback === undefined) return;
            for (const inner of nodesOf(callback, visitorKeys, nested))
              context.report({
                node: inner,
                message:
                  'A lane never runs inside another lane: resolve the worktree, refresh the inventory and take any other lane before or after this one, never inside its callback, because nested serial queues can wait on each other indefinitely.',
              });
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
            const holds = node.body.body.some((member) => {
              const annotation = member.typeAnnotation?.typeAnnotation;
              return (
                member.type === 'PropertyDefinition' &&
                annotation?.type === 'TSTypeReference' &&
                annotation.typeName.type === 'Identifier' &&
                laneHolderType.test(annotation.typeName.name)
              );
            });
            if (holds) return;
            for (const call of nodesOf(
              node,
              visitorKeys,
              (entry) => laneCallback(entry) !== undefined,
            ))
              context.report({
                node: call,
                message:
                  'A lane serializes access to something: a use case that holds no store, reader, runner, writer, source, service, worktree check or refresh computes without a lane (lanes.unqueued at most), because serializing pure computation needlessly blocks other work.',
              });
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
                    'Resolve the worktree with checkWorktree before choosing its lane; the lane is a property of the resolved worktree, because the resolved worktree determines the correct serialization key.',
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
    'kernel-is-types': {
      create(context) {
        if (!kernelTypesFile.test(repositoryPath(context)) || isSpec(context))
          return {};
        const report = (node) =>
          context.report({
            node,
            message:
              'Kernel models and ports hold types only; a pure function belongs in kernel rules/, an error class in kernel errors/, anything else in a domain, because runtime behavior needs an explicit rules or domain owner.',
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
        return {
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
                message:
                  'Write an optional property as ?: T | undefined, because exact optional properties distinguish omission from an explicit undefined.',
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
                message: `${node.id.name} is an object or a domain type; return void without a Result alias when there is no result, because a Result must communicate an outcome.`,
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
                  'Time comes from the Clock port as an ISO string; Date arithmetic lives in rules/ and adapters/ only, because tests must control the instant an operation observes.',
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
                  'Return a named outcome or throw the named error; execute never answers T | undefined, because callers need an explicit outcome for an absent result.',
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
          'Pass the signal to the port and never inspect it; an abort propagates as an error, because cancellation must reach the operation doing the work.';
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
    'port-shape': {
      create(context) {
        const path = repositoryPath(context);
        if (!anyPortFile.test(path) || indexFile.test(path) || isSpec(context))
          return {};
        const visitorKeys = context.sourceCode.visitorKeys;
        const checkParameters = (node, parameters, returned, useCase) => {
          const names = parameters.map(parameterName);
          if (useCase) {
            if (
              node.type !== 'TSMethodSignature' ||
              propertyName(node, context) !== 'execute' ||
              parameters.length !== 2 ||
              names[0] !== 'input' ||
              names[1] !== 'context'
            )
              context.report({
                node,
                message:
                  'A *UseCasePort stands for one server use case another use case or the runtime calls: it declares only execute(input, context), the use case shape, and nothing else, because callers and implementations must agree on input and cancellation.',
              });
          } else if (
            parameters.length > 2 ||
            (parameters.length >= 1 && names[0] !== 'input') ||
            (parameters.length === 2 && names[1] !== 'signal')
          )
            context.report({
              node,
              message:
                'A port method takes (), (input) or (input, signal): one input object, then the signal; only a *UseCasePort under apps/server/src/ports declares execute(input, context), because callers and implementations must agree on input and cancellation.',
            });
          const input = parameters[0]?.typeAnnotation?.typeAnnotation;
          if (input && input.type !== 'TSTypeReference')
            context.report({
              node: input,
              message:
                'A port input is a named model from models/ or the kernel, never an inline or primitive type, because callers and implementations must agree on input and cancellation.',
            });
          if (containsType(returned, 'TSTypeLiteral', visitorKeys))
            context.report({
              node: returned,
              message:
                'A port answers a named model from its own models/ or the kernel; an inline shape copies another domain unseen, because callers and implementations must agree on input and cancellation.',
            });
        };
        return {
          TSInterfaceDeclaration(node) {
            const useCase =
              useCasePortName.test(node.id.name) && serverAppFile.test(path);
            for (const member of node.body.body) {
              if (useCase && member.type !== 'TSMethodSignature')
                checkParameters(member, [], undefined, true);
              if (member.type === 'TSMethodSignature')
                checkParameters(
                  member,
                  member.params,
                  member.returnType?.typeAnnotation,
                  useCase,
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
          'A limit arrives as a typed option from config through compose; rules and services export no constants, because hard-coded limits cannot be supplied by composition or varied by tests.';
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
                  'A service takes its numbers as options from config; no numeric literal above 1, because hard-coded limits cannot be supplied by composition or varied by tests.',
              });
          },
        };
      },
    },
    'no-number-outside-limits': {
      create(context) {
        const path = repositoryPath(context);
        if (
          !numberFreeFile.test(path) ||
          limitsFile.test(path) ||
          visualViewFile.test(path) ||
          webPart(path) === 'ui' ||
          isSpec(context)
        )
          return {};
        const message =
          'An operational number above 1 lives in contracts/shared/limits.ts when the server enforces it too, otherwise in the server, web or mobile config/limits.ts, and arrives as a parameter or an option. Visual values in views are outside this rule, because duplicated operational limits drift between clients and server.';
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
          if (
            value !== undefined &&
            value > 1 &&
            !allowedNumberContext(node, value)
          )
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
              node.parent?.type !== 'TSLiteralType' &&
              !allowedNumberContext(node, node.value)
            )
              context.report({ node, message });
          },
        };
      },
    },

    'implementation-port': {
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
                  'An implementation class implements exactly one port interface, because implementing multiple ports couples independently owned capabilities.',
              });
              return;
            }
          },
        };
      },
    },
    'bootstrap-starts-nothing': {
      create(context) {
        if (!composeSource.test(normalizedFilename(context.filename)))
          return {};
        const message =
          'Composition builds objects only; defaults belong in config, starting and running in runtime, because construction must not start work that the runtime cannot shut down.';
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
    'spec-no-mocking': {
      create(context) {
        if (!isSpec(context)) return {};
        return {
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
        if (!isSpec(context)) return {};
        const message =
          'Every spec runs every time; remove the skip, only, todo or fails, because a skipped or exclusive case leaves regressions unchecked.';
        return {
          MemberExpression(node) {
            const testMember = testFunctions.has(chainRoot(node) ?? '');
            if (testMember && node.computed && memberName(node) === undefined) {
              context.report({
                node: node.property,
                message:
                  'Call describe, it and test by their names; a computed member hides a skip, because a skipped or exclusive case leaves regressions unchecked.',
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
        if (!spec) return hollow;
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
                  'Assert on an observable result, because a boolean literal cannot detect a product regression.',
              });
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
                  'Name the matcher: expect(actual) asserts nothing until a matcher such as toEqual is called on it, because a case must detect a change in observable behavior.',
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
                  'A spec imports its modules statically, because unit tests must exercise their own unit through its supported boundaries.',
              });
            return;
          }
          if (!allowedSpecImport(context.filename, source))
            context.report({
              node: node.source,
              message:
                'A spec imports only vitest, its sibling unit, @porcelain/<domain>/{services,rules,models,errors,store-contracts}, @porcelain/kernel/{models,rules,errors,fakes}, node:{fs,path,os,child_process}, spec/fakes and spec/fixtures; a storage spec, and a server adapter spec that runs a store contract over storage, imports the storage public API, because unit tests must exercise their own unit through its supported boundaries.',
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
          'Models hold types only; behaviour belongs in rules/ and data in services, because runtime behavior in a model bypasses the rules and service owners.';
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
              context.report({
                node,
                message:
                  'Models import types only, because runtime behavior in a model bypasses the rules and service owners.',
              });
          },
        };
      },
    },
    'bootstrap-constructs-only': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!composeSource.test(path)) return {};
        const message =
          'Composition constructs only; decisions belong in use cases and services, starting and scheduling in runtime, because decisions and scheduling need owners that can be tested independently.';
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

    'no-null-in-domain': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!domainSource.test(path) && !useCaseSource.test(path)) return {};
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
                    'Use cases import services, models and contracts as types only, because orchestration must use public domain boundaries and validated contracts.',
                });
              return;
            }
            if (typeof source === 'string' && useCaseValueModule.test(source))
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
    'no-schema-parse-in-typed-code': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!useCaseSource.test(path) && !typedPackageSource.test(path))
          return {};
        const message =
          'Typed code trusts its input; parse untrusted data at the transport boundary, because the transport has already validated these contract types.';
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
        if (!role || isSpec(context)) return {};
        const roleLabel = role === 'UseCase' ? 'Use case' : role;
        const exportMessage =
          'Export one operation class and types, because extra runtime exports bypass its execute boundary.';
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
                      message: `${roleLabel} classes expose only execute; make constructor properties private, because every caller needs one explicit execute boundary.`,
                    });
                  if (
                    parameter.type === 'TSParameterProperty' &&
                    !parameter.readonly
                  )
                    context.report({
                      node: parameter,
                      message: `${roleLabel} fields are readonly; an operation holds its collaborators, never state, because every caller needs one explicit execute boundary.`,
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
                  message: `${roleLabel} fields are readonly; an operation holds its collaborators, never state, because every caller needs one explicit execute boundary.`,
                });
              if (isPrivateMember(member)) continue;
              context.report({
                node: member,
                message: `${roleLabel} classes expose only execute; make other members private, because every caller needs one explicit execute boundary.`,
              });
            }
            if (executes.length !== 1) {
              context.report({
                node: declaration,
                message: `${roleLabel} classes need one public execute method, because every caller needs one explicit execute boundary.`,
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
                    'Name the execute input in models/; Record<never, never>, {}, object and unknown say nothing. Drop the parameter when there is no input, because every caller needs one explicit execute boundary.',
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
                message:
                  'Export exactly one operation class, because each file owns one execute boundary.',
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
                  'Register a feature route with one HTTP method: api.get, api.post, api.put, api.patch or api.delete, because each endpoint must use validated contracts and one domain operation.',
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
                  'A feature route needs a literal path, imported contract schemas for input and output, and one arrow handler, because each endpoint must use validated contracts and one domain operation.',
              });
            if (handler?.type !== 'ArrowFunctionExpression') return;
            if (page) {
              if (!isPageBody(pageSendArgument(handler), renderers))
                context.report({
                  node: handler,
                  message:
                    'A page handler is one expression: reply, then .header or .type calls with string literals, then .send(await options.useCase.execute(...)) or .send(render(await options.useCase.execute(...))) where render is imported from http/presenters/, because each endpoint must use validated contracts and one domain operation.',
                });
              return;
            }
            const call = routeHandlerCall(handler);
            if (!call || !isUseCaseExecute(call.callee))
              context.report({
                node: handler,
                message:
                  'The handler body is one call to options.useCase.execute, returned as it is or sent with reply.code(status).send(result), because each endpoint must use validated contracts and one domain operation.',
              });
          },
          'Program:exit'(node) {
            if (registrations !== 1 || useCaseCalls !== 1)
              context.report({
                node,
                message:
                  'A feature route registers one endpoint and calls options.useCase.execute once, because each endpoint must use validated contracts and one domain operation.',
              });
          },
        };
      },
    },
  },
};
