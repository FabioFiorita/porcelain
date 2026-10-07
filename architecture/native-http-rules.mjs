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
function variable(context, node) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    const found = scope.set.get(node.name);
    if (found) return found;
    scope = scope.upper;
  }
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
                'Register feature endpoints through the typed Effect group, because hand-written transport methods, paths and hooks bypass the shared contract and scope policy.',
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
          const handler = node.arguments[1];
          const resolved = value(handler, context);
          const body = resolved?.body;
          if (
            !body ||
            nodes(body, context.sourceCode.visitorKeys, operation).length !== 1
          )
            context.report({
              node: handler ?? node,
              message:
                'A handler calls one use case, because the use case owns the operation shared by every transport.',
            });
        },
      };
    },
  },
};
