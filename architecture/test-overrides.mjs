import { findVariable } from './scope.mjs';

function resolved(node, context, seen = new Set()) {
  if (!node) return undefined;
  if (['TSAsExpression', 'TSSatisfiesExpression'].includes(node.type))
    return resolved(node.expression, context, seen);
  if (node.type !== 'Identifier' || seen.has(node.name)) return node;
  seen.add(node.name);
  const definition = findVariable(context.sourceCode.getScope(node), node.name)
    ?.defs[0];
  if (definition?.node.type === 'FunctionDeclaration') return definition.node;
  return definition?.node.type === 'VariableDeclarator'
    ? resolved(definition.node.init, context, seen)
    : node;
}

function callback(node, context) {
  const value = resolved(node, context);
  if (
    [
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
    ].includes(value?.type)
  )
    return true;
  return (
    value?.type === 'Identifier' &&
    findVariable(context.sourceCode.getScope(value), value.name)?.defs[0]
      ?.type === 'ImportBinding'
  );
}

function forbiddenOptions(node, context, seen = new Set()) {
  if (seen.has(node)) return false;
  seen.add(node);
  const value = resolved(node, context);
  if (value?.type !== 'ObjectExpression') return false;
  return value.properties.some((property) =>
    property.type === 'SpreadElement'
      ? forbiddenOptions(property.argument, context, seen)
      : ['retry', 'repeats', 'timeout'].includes(
          property.computed
            ? resolved(property.key, context)?.value
            : (property.key.name ?? property.key.value),
        ),
  );
}

export function testOverrides(node, context, hook = false) {
  const options = resolved(node.arguments[1], context);
  return (
    (node.arguments.length > (hook ? 1 : 2) &&
      (hook ||
        (options?.type !== 'ObjectExpression' &&
          !callback(node.arguments.at(-1), context)))) ||
    node.arguments.some((argument) => forbiddenOptions(argument, context))
  );
}
