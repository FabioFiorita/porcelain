export function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return undefined;
}

export function variableOf(context, identifier) {
  return findVariable(context.sourceCode.getScope(identifier), identifier.name);
}
