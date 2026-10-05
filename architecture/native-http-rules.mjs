const routeSource = /\/apps\/server\/src\/http\/routes\/.+\.ts$/;
const rawMethods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'route',
  'all',
  'register',
  'addHook',
]);
const controlFlow = new Set([
  'IfStatement',
  'ConditionalExpression',
  'SwitchStatement',
  'TryStatement',
  'ForStatement',
  'ForOfStatement',
  'ForInStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ThrowStatement',
  'AwaitExpression',
]);

function variable(context, node) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    const found = scope.set.get(node.name);
    if (found) return found;
    scope = scope.upper;
  }
}

function imported(context, node, source, name) {
  if (node?.type !== 'Identifier') return false;
  const definition = variable(context, node)?.defs[0];
  return (
    definition?.type === 'ImportBinding' &&
    definition.parent.source.value === source &&
    definition.node.imported?.name === name
  );
}

function property(node) {
  return node.computed ? node.property?.value : node.property?.name;
}

function nodes(node, keys, accept) {
  if (!node || typeof node.type !== 'string') return [];
  const found = accept(node) ? [node] : [];
  for (const key of keys[node.type] ?? []) {
    const value = node[key];
    for (const child of Array.isArray(value) ? value : [value])
      found.push(...nodes(child, keys, accept));
  }
  return found;
}

function value(node, context, seen = new Set()) {
  if (!node || seen.has(node)) return undefined;
  seen.add(node);
  if (node.type === 'Identifier') {
    const definition = variable(context, node)?.defs[0]?.node;
    return value(
      definition?.type === 'VariableDeclarator' ? definition.init : definition,
      context,
      seen,
    );
  }
  if (node.type === 'CallExpression') {
    const called = value(node.callee, context, seen);
    if (
      !called ||
      ![
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression',
      ].includes(called.type)
    )
      return undefined;
    if (called.body.type === 'ObjectExpression') return called.body;
    const returns =
      called.body.body?.filter(
        (statement) => statement.type === 'ReturnStatement',
      ) ?? [];
    return returns.length === 1
      ? value(returns[0].argument, context, seen)
      : undefined;
  }
  if (node.type === 'MemberExpression') {
    const object = value(node.object, context, seen);
    const name = property(node);
    const found =
      object?.type === 'ObjectExpression'
        ? object.properties.find(
            (entry) =>
              entry.type === 'Property' &&
              (entry.key.name ?? entry.key.value) === name,
          )
        : undefined;
    return value(found?.value, context, seen);
  }
  return node;
}

function nativeGroup(node, context) {
  const callee = node.callee;
  return (
    callee.type === 'MemberExpression' &&
    property(callee) === 'group' &&
    imported(context, callee.object, 'effect/http-api', 'HttpApiBuilder')
  );
}

function operation(node) {
  if (
    node.type !== 'CallExpression' ||
    node.callee.type !== 'MemberExpression' ||
    property(node.callee) !== 'execute'
  )
    return false;
  let receiver = node.callee.object;
  while (receiver.type === 'MemberExpression') receiver = receiver.object;
  return (
    receiver.type === 'Identifier' &&
    ['useCase', 'useCases'].includes(receiver.name)
  );
}

function inRoute(context) {
  return (
    routeSource.test(context.filename.replaceAll('\\', '/')) &&
    !/\.spec\.ts$/.test(context.filename)
  );
}

export const nativeHttpRules = {
  'feature-route-shape': {
    create(context) {
      if (!inRoute(context)) return {};
      let groups = 0;
      let bridges = 0;
      return {
        CallExpression(node) {
          if (nativeGroup(node, context)) {
            groups += 1;
            const [api, group, build] = node.arguments;
            const definition =
              api?.type === 'Identifier'
                ? variable(context, api)?.defs[0]
                : undefined;
            if (
              definition?.type !== 'ImportBinding' ||
              !/^@porcelain\/contracts\/[^/]+$/.test(
                definition.parent.source.value,
              ) ||
              !/Api$/.test(definition.node.imported?.name ?? '') ||
              typeof group?.value !== 'string' ||
              build?.type !== 'ArrowFunctionExpression'
            )
              context.report({
                node,
                message:
                  'Build a named Effect group from an imported contract API, because the contract owns endpoint names, request codecs and complete handler coverage.',
              });
          }
          if (node.callee.type === 'Identifier') {
            const definition = variable(context, node.callee)?.defs[0];
            if (
              definition?.type === 'ImportBinding' &&
              definition.node.imported?.name === 'effectRoutes' &&
              /\/effect-bridge\.ts$/.test(definition.parent.source.value)
            )
              bridges += 1;
          }
        },
        'Program:exit'(node) {
          if (groups === 0 || bridges === 0)
            context.report({
              node,
              message:
                'Export contract-backed Effect handler groups through effectRoutes, because hand-written transport declarations disconnect the server from its generated client.',
            });
        },
      };
    },
  },
  'feature-route-registrations': {
    create(context) {
      if (!inRoute(context)) return {};
      return {
        CallExpression(node) {
          if (
            node.callee.type === 'MemberExpression' &&
            rawMethods.has(property(node.callee))
          )
            context.report({
              node,
              message:
                'Register feature endpoints through the typed Effect group, because hand-written Fastify methods, paths and hooks bypass the shared contract and scope policy.',
            });
        },
      };
    },
  },
  'feature-route-handler': {
    create(context) {
      if (!inRoute(context)) return {};
      return {
        CallExpression(node) {
          if (
            node.callee.type !== 'MemberExpression' ||
            property(node.callee) !== 'handle'
          )
            return;
          const [name, handler] = node.arguments;
          const resolved = value(handler, context);
          const body = resolved?.body;
          if (
            typeof name?.value !== 'string' ||
            ![
              'FunctionDeclaration',
              'FunctionExpression',
              'ArrowFunctionExpression',
            ].includes(resolved?.type) ||
            resolved.async ||
            !body ||
            nodes(body, context.sourceCode.visitorKeys, operation).length !==
              1 ||
            nodes(body, context.sourceCode.visitorKeys, (entry) =>
              controlFlow.has(entry.type),
            ).length > 0
          )
            context.report({
              node: handler ?? node,
              message:
                'A named Effect handler calls one use case and only adapts caller identity or presentation, because domain decisions and sequencing must stay in the use case shared by every transport.',
            });
        },
      };
    },
  },
};
