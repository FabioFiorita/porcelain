function globalRoot(node) {
  while (node?.type === 'MemberExpression') node = node.object;
  return (
    node?.type === 'Identifier' &&
    ['console', 'window', 'globalThis', 'global'].includes(node.name)
  );
}

export function replacesGlobal(node) {
  if (node.type === 'AssignmentExpression')
    return node.left.type === 'MemberExpression' && globalRoot(node.left);
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'Object' &&
    (node.callee.computed
      ? node.callee.property.value
      : node.callee.property.name) === 'defineProperty' &&
    globalRoot(node.arguments[0])
  );
}
