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
  if (
    node.type !== 'CallExpression' ||
    node.callee.type !== 'MemberExpression' ||
    node.callee.object.type !== 'Identifier'
  )
    return false;
  const owner = node.callee.object.name;
  const method = node.callee.computed
    ? node.callee.property.value
    : node.callee.property.name;
  return (
    ((method === 'defineProperty' && ['Object', 'Reflect'].includes(owner)) ||
      (method === 'assign' && owner === 'Object')) &&
    globalRoot(node.arguments[0])
  );
}
