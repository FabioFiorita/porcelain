import { fileURLToPath } from 'node:url';
import { classify, nodeGlobalRoles } from './policy.ts';

const domainPackage = '(?:projects|changes|reviews|files|git-actions|access)';
const domainSource = new RegExp(
  `/packages/${domainPackage}/src/(?:services|rules|models|ports|errors)/`,
);
const domainModule = new RegExp(
  `^@porcelain/${domainPackage}/(?:services|models)$`,
);
const controllerSource = /\/apps\/server\/src\/controllers\//;
const modelsSource =
  /\/packages\/(?:access|changes|files|git-actions|projects|reviews)\/src\/models\/[^/]+\.ts$/;
const composeSource = /\/apps\/server\/src\/bootstrap\/compose-[^/]+\.ts$/;
const typedPackageSource =
  /\/packages\/[^/]+\/src\/(?:services|rules|models|ports)\//;
const routeSource = /\/apps\/server\/src\/http\/routes\/.+\.ts$/;
const pageSource = /-page\.ts$/;
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
    /\/apps\/server\/src\/controllers\/(?:[^/]+\/)*[^/]+-controller\.ts$/.test(
      path,
    )
  )
    return 'Controller';
  if (
    /\/packages\/[^/]+\/src\/services\/(?:[^/]+\/)*[^/]+-service\.ts$/.test(
      path,
    )
  )
    return 'Service';
  return undefined;
}

function expectedClassName(filename) {
  return normalizedFilename(filename)
    .split('/')
    .at(-1)
    .slice(0, -3)
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
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
  if (role === 'Controller')
    return parameters.length === 2 &&
      parameterName(parameters[0]) === 'input' &&
      parameterName(parameters[1]) === 'context'
      ? undefined
      : 'Controller execute takes (input, context).';
  const second = parameters[1];
  return parameters.length >= 1 &&
    parameters.length <= 2 &&
    parameterName(parameters[0]) === 'input' &&
    (!second || (parameterName(second) === 'signal' && second.optional))
    ? undefined
    : 'Service execute takes (input, signal?).';
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

function isControllerExecute(callee) {
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
    callee.object.property.name === 'controller'
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

function pageRenderers(program) {
  return new Set(
    program.body
      .map((statement) =>
        statement.type === 'ExportNamedDeclaration'
          ? statement.declaration
          : statement,
      )
      .filter(
        (statement) =>
          statement?.type === 'FunctionDeclaration' &&
          statement.id &&
          statement.params.length === 1,
      )
      .map((statement) => statement.id.name),
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

function isPageBody(argument, renderers) {
  if (argument?.type !== 'CallExpression') return false;
  if (isControllerExecute(argument.callee)) return true;
  const rendered = argument.arguments[0];
  return (
    argument.callee.type === 'Identifier' &&
    renderers.has(argument.callee.name) &&
    argument.arguments.length === 1 &&
    rendered.type === 'CallExpression' &&
    isControllerExecute(rendered.callee)
  );
}

const specSource = /\.spec\.ts$/;
const storageSpec = /\/packages\/storage\/src\/.+\.spec\.ts$/;
const storagePublicApi =
  /\/packages\/storage\/src\/(?:index|repositories\/[^/]+\/index)\.ts$/;
const specNodeModule = /^node:(?:fs|path|os|child_process)(?:\/[a-z]+)?$/;
const specPackageEntry = new RegExp(
  `^@porcelain/${domainPackage}/(?:services|rules|models|errors)$`,
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
const skippingModifiers = new Set(['skip', 'only', 'todo', 'skipIf', 'runIf']);
const httpStatus =
  /(?:^|\s)[1-5]\d\d(?=\s*$|\s+(?:when|if|for|unless)\b)|^\s*[1-5]\d\d\b|\bhttp\s+(?:status|code|[1-5]\d\d)\b|\bstatus\s+code|\b(?:status|code)\s+[1-5]\d\d\b/i;

const repositoryRoot = normalizedFilename(
  fileURLToPath(new URL('..', import.meta.url)),
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
]);
const featureMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const routeHook = /^(?:on|pre)[A-Z]|^(?:handler|errorHandler)$/;
const disableDirective = /^\s*(?:eslint|oxlint)-(?:disable|enable)/;
const packageSource = /^packages\/[^/]+\/src\//;
const useCaseFile = /^apps\/server\/src\/use-cases\/[^/]+\/[^/]+\.ts$/;
const operationFile =
  /^(?:packages\/[^/]+\/src\/services\/(?:[^/]+\/)*[^/]+-service|apps\/server\/src\/controllers\/(?:[^/]+\/)*[^/]+-controller|apps\/server\/src\/use-cases\/[^/]+\/[^/]+)\.ts$/;
const domainCode = new RegExp(
  `^(?:packages/${domainPackage}/src/(?:services|rules|models|ports|errors)/|packages/kernel/src/|apps/server/src/(?:controllers|use-cases)/)`,
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

function isFunction(node) {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression'
  );
}

function awaited(node) {
  return node?.type === 'AwaitExpression' ? node.argument : node;
}

function isUseCaseExecute(node) {
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
    if (isUseCaseExecute(returned)) return returned;
    const sent = awaited(replySent(returned, reply));
    return isUseCaseExecute(sent) ? sent : undefined;
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
    isUseCaseExecute(call) &&
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

function moduleSource(node) {
  const source = node.source;
  if (source?.type === 'Literal' && typeof source.value === 'string')
    return source.value;
  return undefined;
}

function isSpec(context) {
  return specSource.test(normalizedFilename(context.filename));
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
  if (!source.startsWith('.')) return false;
  const path = normalizedFilename(filename);
  const unit = path.split('/').at(-1).replace(specSource, '.ts');
  if (source === `./${unit}`) return true;
  const target = new URL(
    source,
    `file://${path.startsWith('/') ? '' : '/'}${path}`,
  ).pathname;
  if (storageSpec.test(path)) return storagePublicApi.test(target);
  return /\/spec\/fakes\/.+\.ts$/.test(target);
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
    'feature-route-handler': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!routeSource.test(path) || pageSource.test(path)) return {};
        return {
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
          !controllerSource.test(path) &&
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
        if (!packageSource.test(path)) return {};
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
                  specifier.imported.name === 'vi')
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
        return {
          MemberExpression(node) {
            if (
              skippingModifiers.has(memberName(node) ?? '') &&
              testFunctions.has(chainRoot(node) ?? '')
            )
              context.report({
                node: node.property,
                message:
                  'Every spec runs every time; remove the skip, only or todo.',
              });
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
            if (httpStatus.test(title))
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
                'A spec imports only vitest, its sibling unit, @porcelain/<domain>/{services,rules,models,errors}, node:{fs,path,os,child_process} and spec/fakes; a storage spec imports the storage public API instead of fakes.',
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
          'Composition constructs only; decisions belong in controllers and services, schedules in jobs/.';
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
        if (!domainSource.test(path) && !controllerSource.test(path)) return {};
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
    'controller-imports': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!controllerSource.test(path)) return {};
        const reexport = (node) =>
          context.report({
            node,
            message:
              'Controllers export their class only; they do not re-export.',
          });
        return {
          ImportDeclaration(node) {
            const source = node.source.value;
            if (
              typeof source === 'string' &&
              /^\.\.\/runtime\/[^/]+\.ts$/.test(source)
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
                    'Controllers import services, models and contracts as types only.',
                });
              return;
            }
            context.report({
              node,
              message:
                'Controllers import only @porcelain/<domain>/services, @porcelain/<domain>/models, @porcelain/contracts/<domain> and ../runtime/<file>.',
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
        if (!controllerSource.test(path) && !typedPackageSource.test(path))
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
        const expectedName = expectedClassName(context.filename);
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
                for (const parameter of member.value.params)
                  if (
                    parameter.type === 'TSParameterProperty' &&
                    parameter.accessibility !== 'private' &&
                    parameter.accessibility !== 'protected'
                  )
                    context.report({
                      node: parameter,
                      message: `${role} classes expose only execute; make constructor properties private.`,
                    });
                continue;
              }
              if (isPrivateMember(member)) continue;
              context.report({
                node: member,
                message: `${role} classes expose only execute; make other members private.`,
              });
            }
            if (executes.length !== 1) {
              context.report({
                node: declaration,
                message: `${role} classes need one public execute method.`,
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
        let controllerCalls = 0;
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
            if (isControllerExecute(callee)) controllerCalls += 1;
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
                    'A page handler is one expression: reply, then .header or .type calls with string literals, then .send(options.controller.execute(...)) or .send(render(options.controller.execute(...))) where render is a one-parameter function declared in this file.',
                });
              return;
            }
            const call = handlerCall(handler);
            if (!call || !isControllerExecute(call.callee))
              context.report({
                node: handler,
                message:
                  'The handler body is one call to options.controller.execute.',
              });
          },
          'Program:exit'(node) {
            if (registrations !== 1 || controllerCalls !== 1)
              context.report({
                node,
                message:
                  'A feature route registers one endpoint and calls options.controller.execute once.',
              });
          },
        };
      },
    },
  },
};
