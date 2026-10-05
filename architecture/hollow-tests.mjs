export const testSource = /\.(?:spec|test|integration|perf|browser|e2e)\.tsx?$/;

const caseNames = new Set(['it', 'test']);
const caseModifiers = new Set([
  'only',
  'skip',
  'todo',
  'concurrent',
  'sequential',
  'fails',
  'skipIf',
  'runIf',
  'each',
  'for',
  'effect',
]);
const assertionEntries = new Set(['soft', 'poll', 'element']);
const equalityMatchers = new Set(['toBe', 'toEqual', 'toStrictEqual']);
const comparisonOperators = new Set([
  '===',
  '!==',
  '==',
  '!=',
  '<',
  '>',
  '<=',
  '>=',
]);
const booleanMethods = new Set([
  'includes',
  'startsWith',
  'endsWith',
  'has',
  'test',
]);
const mockMatcher =
  /^toHave(?:BeenCalled|(?:Last|Nth)?(?:Returned|Resolved|CalledWith))/;
const handedOff = new Set([
  'push',
  'unshift',
  'splice',
  'set',
  'add',
  'delete',
  'clear',
  'sort',
  'reverse',
  'fill',
  'pop',
  'shift',
  'assign',
]);
const ignoredKeys = new Set(['parent', 'range', 'loc', 'start', 'end']);

function isFunction(node) {
  return (
    node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'FunctionDeclaration'
  );
}

function propertyOf(member) {
  if (member.computed)
    return member.property.type === 'Literal' ? member.property.value : '';
  return member.property.type === 'Identifier' ? member.property.name : '';
}

function rootName(node) {
  let current = node;
  while (
    current?.type === 'MemberExpression' ||
    current?.type === 'CallExpression'
  )
    current =
      current.type === 'MemberExpression' ? current.object : current.callee;
  return current?.type === 'Identifier' ? current.name : undefined;
}

function* children(node) {
  for (const [key, value] of Object.entries(node)) {
    if (ignoredKeys.has(key) || value === null || typeof value !== 'object')
      continue;
    if (Array.isArray(value)) {
      for (const entry of value)
        if (entry && typeof entry.type === 'string') yield entry;
    } else if (typeof value.type === 'string') yield value;
  }
}

function walk(node, visit, intoFunctions = true) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const child of children(node))
    if (intoFunctions || !isFunction(child)) walk(child, visit, intoFunctions);
}

function some(node, test, intoFunctions = false) {
  let found = false;
  walk(
    node,
    (entry) => {
      if (found) return false;
      if (test(entry)) found = true;
      return !found;
    },
    intoFunctions,
  );
  return found;
}

export function caseBody(call) {
  const callee = call.callee;
  const registered =
    (callee.type === 'Identifier' && caseNames.has(callee.name)) ||
    (callee.type === 'MemberExpression' &&
      caseNames.has(rootName(callee) ?? '') &&
      caseModifiers.has(propertyOf(callee))) ||
    (callee.type === 'CallExpression' &&
      callee.callee.type === 'MemberExpression' &&
      caseNames.has(rootName(callee.callee) ?? '') &&
      caseModifiers.has(propertyOf(callee.callee)));
  if (!registered) return undefined;
  const last = call.arguments.at(-1);
  return isFunction(last) ? last : undefined;
}

function expectEntry(call) {
  const callee = call.callee;
  return (
    (callee.type === 'Identifier' && callee.name === 'expect') ||
    (callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'expect' &&
      assertionEntries.has(propertyOf(callee)))
  );
}

function assertionAt(call) {
  if (!expectEntry(call)) return undefined;
  let chain = call;
  const properties = [];
  while (
    chain.parent?.type === 'MemberExpression' &&
    chain.parent.object === chain
  ) {
    chain = chain.parent;
    properties.push(propertyOf(chain));
  }
  const matcher =
    chain !== call &&
    chain.parent?.type === 'CallExpression' &&
    chain.parent.callee === chain
      ? chain.parent
      : undefined;
  const actual = call.arguments[0];
  return {
    call,
    actual: isFunction(actual) ? returned(actual) : actual,
    matcher: matcher ? properties.at(-1) : undefined,
    negated: properties.includes('not'),
    expected: matcher ? matcher.arguments : [],
  };
}

function returned(fn) {
  if (fn.body.type !== 'BlockStatement') return fn.body;
  const statement = fn.body.body.find(
    (entry) => entry.type === 'ReturnStatement',
  );
  return statement?.argument ?? fn.body;
}

function literal(node) {
  if (!node) return false;
  if (node.type === 'Literal') return true;
  if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
  if (node.type === 'UnaryExpression') return literal(node.argument);
  if (node.type === 'ArrayExpression') return node.elements.every(literal);
  if (node.type === 'ObjectExpression')
    return node.properties.every(
      (property) => property.type === 'Property' && literal(property.value),
    );
  return false;
}

function numberLiteral(node, values) {
  return node?.type === 'Literal' && values.includes(node.value);
}

function matchesEmpty(node) {
  if (node?.type !== 'Literal') return false;
  if (node.value === '') return true;
  const regex = node.regex;
  if (!regex) return false;
  try {
    return new RegExp(regex.pattern, regex.flags.replace(/[gy]/g, '')).test('');
  } catch {
    return false;
  }
}

function valueIdentifier(node) {
  const parent = node.parent;
  if (node.type !== 'Identifier') return false;
  if (parent?.type === 'MemberExpression' && parent.property === node)
    return parent.computed;
  if (
    parent?.type === 'Property' &&
    parent.key === node &&
    !parent.computed &&
    parent.value !== node
  )
    return false;
  if (parent?.type === 'CallExpression' && parent.callee === node) return false;
  if (
    parent?.type === 'VariableDeclarator' ||
    parent?.type === 'ImportSpecifier' ||
    parent?.type === 'ImportDefaultSpecifier' ||
    parent?.type === 'ImportNamespaceSpecifier'
  )
    return false;
  return !isFunction(parent) || parent.body === node;
}

function patternNames(pattern, into) {
  if (!pattern) return into;
  if (pattern.type === 'Identifier') into.push(pattern.name);
  else if (pattern.type === 'ObjectPattern')
    for (const property of pattern.properties)
      patternNames(
        property.type === 'RestElement' ? property.argument : property.value,
        into,
      );
  else if (pattern.type === 'ArrayPattern')
    for (const element of pattern.elements) patternNames(element, into);
  else if (pattern.type === 'AssignmentPattern')
    patternNames(pattern.left, into);
  else if (pattern.type === 'RestElement') patternNames(pattern.argument, into);
  return into;
}

function scopeOf(program, body, sourceCode) {
  const bindings = new Map();
  const add = (names, binding) => {
    for (const name of names) bindings.set(name, binding);
  };
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration')
      for (const specifier of statement.specifiers)
        bindings.set(specifier.local.name, {
          kind: 'import',
          source: statement.source.value,
        });
  }
  const declare = (node, local = false) => {
    if (node.type === 'FunctionDeclaration' && node.id)
      bindings.set(node.id.name, { kind: 'function' });
    if (node.type === 'VariableDeclaration')
      for (const declarator of node.declarations)
        add(
          patternNames(declarator.id, []),
          isFunction(declarator.init)
            ? { kind: 'function' }
            : {
                kind: node.kind === 'const' ? 'const' : 'let',
                init: declarator.init,
                declarator,
                local,
              },
        );
  };
  for (const statement of program.body)
    declare(
      statement.type === 'ExportNamedDeclaration' && statement.declaration
        ? statement.declaration
        : statement,
    );
  for (const param of body.params)
    add(patternNames(param, []), { kind: 'param' });
  walk(body.body, (node) => {
    if (
      node.type === 'VariableDeclaration' ||
      node.type === 'FunctionDeclaration'
    )
      declare(node, true);
    if (isFunction(node) && node !== body)
      for (const param of node.params)
        add(patternNames(param, []), { kind: 'param' });
  });
  const references = new Map();
  walk(body, (node) => {
    if (node.type === 'Identifier') {
      const list = references.get(node.name) ?? [];
      list.push(node);
      references.set(node.name, list);
    }
  });
  return { bindings, references, sourceCode, body };
}

function handedOffAnywhere(name, scope) {
  return (scope.references.get(name) ?? []).some((reference) => {
    const parent = reference.parent;
    return (
      (parent?.type === 'CallExpression' &&
        parent.arguments.includes(reference)) ||
      (parent?.type === 'MemberExpression' &&
        parent.object === reference &&
        handedOff.has(propertyOf(parent))) ||
      (parent?.type === 'AssignmentExpression' && parent.left === reference)
    );
  });
}

function awaitBound(binding) {
  if (binding.kind === 'let') return binding.local;
  return (
    !binding.init ||
    some(binding.init, (node) => node.type === 'AwaitExpression', true)
  );
}

function computedBoolean(node) {
  if (!node) return false;
  if (node.type === 'BinaryExpression')
    return comparisonOperators.has(node.operator);
  if (node.type === 'UnaryExpression')
    return (
      node.operator === 'typeof' ||
      (node.operator === '!' && computedBoolean(node.argument))
    );
  if (node.type === 'CallExpression')
    return (
      node.callee.type === 'MemberExpression' &&
      booleanMethods.has(propertyOf(node.callee))
    );
  if (node.type === 'ArrayExpression')
    return node.elements.some(computedBoolean);
  if (node.type === 'ObjectExpression')
    return node.properties.some(
      (property) =>
        property.type === 'Property' && computedBoolean(property.value),
    );
  return false;
}

function chainTop(identifier) {
  let top = identifier;
  while (top.parent?.type === 'MemberExpression' && top.parent.object === top)
    top = top.parent;
  return top;
}

function leavesOf(node, scope, seen = new Set()) {
  const leaves = new Set();
  walk(node, (entry) => {
    if (!valueIdentifier(entry) || seen.has(entry.name)) return;
    const binding = scope.bindings.get(entry.name);
    if (!binding || (binding.kind !== 'const' && binding.kind !== 'let'))
      return;
    const suffix = scope.sourceCode
      .getText(chainTop(entry))
      .slice(entry.name.length);
    if (awaitBound(binding)) {
      leaves.add(`${entry.name}${suffix}`);
      return;
    }
    for (const leaf of leavesOf(
      binding.init,
      scope,
      new Set([...seen, entry.name]),
    ))
      leaves.add(`${leaf}${suffix}`);
  });
  return leaves;
}

function within(leaf, other) {
  return (
    leaf === other ||
    leaf.startsWith(`${other}.`) ||
    leaf.startsWith(`${other}[`) ||
    other.startsWith(`${leaf}.`) ||
    other.startsWith(`${leaf}[`)
  );
}

function rootOfLeaf(leaf) {
  return /^[^.[]+/.exec(leaf)?.[0] ?? leaf;
}

function builtFromActual(assertion, scope) {
  const text = (node) => scope.sourceCode.getText(node);
  if (
    assertion.actual &&
    !assertion.negated &&
    assertion.expected.some(
      (argument) => text(argument) === text(assertion.actual),
    )
  )
    return true;
  const actual = [...leavesOf(assertion.actual, scope)];
  if (actual.length === 0) return false;
  return assertion.expected.some((argument) => {
    const expected = [...leavesOf(argument, scope)];
    if (expected.length === 0) return false;
    if (
      assertion.negated &&
      expected.some((leaf) =>
        actual.some((other) => rootOfLeaf(leaf) === rootOfLeaf(other)),
      )
    )
      return true;
    return expected.every((leaf) =>
      actual.some((other) => within(leaf, other)),
    );
  });
}

function originOf(node, at, scope) {
  if (!node) return undefined;
  const name = rootName(node);
  const binding = name === undefined ? undefined : scope.bindings.get(name);
  const text = scope.sourceCode.getText(node);
  if (
    binding?.kind === 'const' &&
    binding.init?.type === 'AwaitExpression' &&
    (node.type === 'Identifier' || node.type === 'MemberExpression')
  )
    return {
      text: `${scope.sourceCode.getText(binding.init)}${text.slice(name.length)}`,
      start: binding.declarator.start,
      end: binding.declarator.end,
    };
  const awaited =
    node.type === 'AwaitExpression' ||
    (node.type === 'MemberExpression' && rootName(node) === undefined);
  return awaited ? { text, start: at, end: at } : undefined;
}

function evaluatedAgain(assertion, scope) {
  const first = originOf(assertion.actual, assertion.call.start, scope);
  const second = originOf(assertion.expected[0], assertion.call.start, scope);
  if (!first || !second || first.text !== second.text) return false;
  const from = Math.min(first.end, second.end);
  const to = Math.max(first.start, second.start);
  return !some(
    scope.body,
    (node) =>
      node.type === 'AwaitExpression' && node.start >= from && node.end <= to,
    true,
  );
}

function builtByTest(node, scope, seen = new Set()) {
  if (!node) return false;
  if (
    some(
      node,
      (entry) =>
        entry.type === 'CallExpression' ||
        entry.type === 'AwaitExpression' ||
        entry.type === 'NewExpression' ||
        entry.type === 'ThisExpression' ||
        isFunction(entry),
      true,
    )
  )
    return false;
  let fixture = true;
  walk(node, (entry) => {
    if (!fixture || !valueIdentifier(entry)) return;
    const binding = scope.bindings.get(entry.name);
    if (
      seen.has(entry.name) ||
      binding?.kind !== 'const' ||
      !binding.init ||
      !builtByTest(binding.init, scope, new Set([...seen, entry.name])) ||
      handedOffAnywhere(entry.name, scope)
    )
      fixture = false;
  });
  return fixture;
}

const presenceMatchers = new Set([
  'toBeDefined',
  'toBeTruthy',
  'toBeInstanceOf',
]);
const absenceMatchers = new Set(['toBeUndefined', 'toBeNull', 'toBeFalsy']);
const throwMatchers = new Set(['toThrow', 'toThrowError']);
const builtins = new Set([
  'Array',
  'BigInt',
  'Boolean',
  'Buffer',
  'Date',
  'JSON',
  'Map',
  'Math',
  'Number',
  'Object',
  'Promise',
  'Reflect',
  'Set',
  'String',
  'Symbol',
  'URL',
  'URLSearchParams',
  'decodeURIComponent',
  'encodeURIComponent',
  'expect',
  'parseFloat',
  'parseInt',
  'structuredClone',
]);
const wrappers = new Set([
  'AwaitExpression',
  'ChainExpression',
  'TSNonNullExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
]);

function unwrapped(node) {
  let current = node;
  while (current && wrappers.has(current.type))
    current =
      current.type === 'AwaitExpression'
        ? current.argument
        : current.expression;
  return current;
}

function calleeKey(node) {
  const callee = unwrapped(node);
  if (callee?.type === 'Identifier') return callee.name;
  if (callee?.type === 'ThisExpression') return 'this';
  if (callee?.type === 'CallExpression' || callee?.type === 'NewExpression')
    return calleeKey(callee.callee);
  if (callee?.type === 'MemberExpression') {
    const owner = calleeKey(callee.object);
    const property = propertyOf(callee);
    return owner && property !== '' ? `${owner}.${property}` : '';
  }
  return '';
}

function emptyValue(node) {
  if (!node) return false;
  if (node.type === 'Identifier') return node.name === 'undefined';
  if (node.type === 'ArrayExpression') return node.elements.length === 0;
  if (node.type === 'ObjectExpression') return node.properties.length === 0;
  if (node.type === 'TemplateLiteral')
    return (
      node.expressions.length === 0 &&
      node.quasis.every((quasi) => quasi.value.cooked === '')
    );
  return (
    node.type === 'Literal' &&
    !node.regex &&
    (node.value === '' || node.value === null || node.value === false)
  );
}

function countOf(node) {
  const actual = unwrapped(node);
  return (
    actual?.type === 'MemberExpression' &&
    ['length', 'size'].includes(propertyOf(actual))
  );
}

function emptiness(assertion) {
  const { matcher, negated, expected, actual } = assertion;
  const [first] = expected;
  if (throwMatchers.has(matcher))
    return negated && expected.length === 0 ? 'absence' : undefined;
  let shape;
  if (absenceMatchers.has(matcher)) shape = 'absence';
  else if (presenceMatchers.has(matcher)) shape = 'presence';
  else if (matcher === 'toHaveLength' && numberLiteral(first, [0]))
    shape = 'absence';
  else if (
    equalityMatchers.has(matcher) &&
    (emptyValue(first) || (countOf(actual) && numberLiteral(first, [0])))
  )
    shape = 'absence';
  else if (
    !negated &&
    ((matcher === 'toBeGreaterThan' && numberLiteral(first, [0])) ||
      (matcher === 'toBeGreaterThanOrEqual' && numberLiteral(first, [1])))
  )
    return 'presence';
  if (!shape || !negated) return shape;
  return shape === 'absence' ? 'presence' : 'absence';
}

function producingCall(node, scope, path = [], seen = new Set()) {
  const value = unwrapped(node);
  if (value?.type === 'CallExpression')
    return { call: value, path: path.join('.') };
  if (value?.type === 'MemberExpression') {
    const property = propertyOf(value);
    if (property === '') return undefined;
    return producingCall(value.object, scope, [property, ...path], seen);
  }
  if (value?.type !== 'Identifier' || seen.has(value.name)) return undefined;
  const binding = scope.bindings.get(value.name);
  if (binding?.kind !== 'const' || !binding.init) return undefined;
  if (binding.declarator.id.type !== 'Identifier') return undefined;
  return producingCall(
    binding.init,
    scope,
    path,
    new Set([...seen, value.name]),
  );
}

function identity(assertion, scope) {
  const { matcher, negated, expected, actual } = assertion;
  if (negated || !equalityMatchers.has(matcher) || expected.length !== 1)
    return undefined;
  const first = producingCall(actual, scope);
  const second = producingCall(expected[0], scope);
  if (!first || !second || first.call === second.call) return undefined;
  const key = calleeKey(first.call.callee);
  if (
    !key ||
    key !== calleeKey(second.call.callee) ||
    first.path !== second.path
  )
    return undefined;
  return key;
}

function spine(node, scope, keys, seen = new Set()) {
  if (!node) return keys;
  const value = unwrapped(node);
  if (!value) return keys;
  switch (value.type) {
    case 'MemberExpression':
      return spine(value.object, scope, keys, seen);
    case 'CallExpression':
    case 'NewExpression': {
      const key = calleeKey(value.callee);
      const root = /^[^.]+/.exec(key)?.[0] ?? '';
      const helper =
        value.callee.type === 'Identifier' &&
        scope.bindings.get(value.callee.name)?.kind === 'function';
      if (key && !builtins.has(root)) keys.add(key);
      if (!key || builtins.has(root) || helper)
        for (const argument of value.arguments)
          spine(argument, scope, keys, seen);
      if (value.callee.type === 'MemberExpression')
        spine(value.callee.object, scope, keys, seen);
      return keys;
    }
    case 'Identifier': {
      const binding = scope.bindings.get(value.name);
      if (
        !seen.has(value.name) &&
        (binding?.kind === 'const' || binding?.kind === 'let') &&
        binding.init
      )
        spine(binding.init, scope, keys, new Set([...seen, value.name]));
      return keys;
    }
    case 'ArrayExpression':
      for (const element of value.elements) spine(element, scope, keys, seen);
      return keys;
    case 'ObjectExpression':
      for (const property of value.properties)
        spine(
          property.type === 'Property' ? property.value : property,
          scope,
          keys,
          seen,
        );
      return keys;
    case 'SpreadElement':
      return spine(value.argument, scope, keys, seen);
    case 'ConditionalExpression':
      spine(value.consequent, scope, keys, seen);
      return spine(value.alternate, scope, keys, seen);
    case 'LogicalExpression':
      spine(value.left, scope, keys, seen);
      return spine(value.right, scope, keys, seen);
    case 'TemplateLiteral':
      for (const expression of value.expressions)
        spine(expression, scope, keys, seen);
      return keys;
    case 'BlockStatement':
      for (const statement of value.body)
        if (statement.type === 'ExpressionStatement')
          spine(statement.expression, scope, keys, seen);
      return keys;
    default:
      return keys;
  }
}

function subjects(assertion, scope, owner) {
  const keys = spine(assertion.actual, scope, new Set());
  for (const statement of owner.body.type === 'BlockStatement'
    ? owner.body.body
    : [])
    if (
      statement.type === 'ExpressionStatement' &&
      !some(
        statement,
        (node) => node.type === 'CallExpression' && expectEntry(node),
        true,
      )
    )
      spine(statement.expression, scope, keys);
  return keys;
}

function permanentWeakness(assertion, scope) {
  const { matcher, actual, expected } = assertion;
  if (mockMatcher.test(matcher)) return `${matcher} checks only a mock`;
  let looseSchema = false;
  for (const argument of expected)
    walk(argument, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        rootName(node.callee) === 'expect' &&
        propertyOf(node.callee) === 'schemaMatching'
      ) {
        const schema = node.arguments[0];
        const binding =
          schema?.type === 'Identifier'
            ? scope.bindings.get(schema.name)
            : undefined;
        if (
          binding?.kind !== 'import' ||
          !String(binding.source).startsWith('@porcelain/contracts')
        )
          looseSchema = true;
      }
    });
  if (looseSchema)
    return 'its schema is not one exported from @porcelain/contracts';
  if (computedBoolean(actual))
    return 'its actual value is a boolean the test computed';
  if (builtByTest(actual, scope))
    return 'its actual value is a value the test built itself';
  return undefined;
}

function copiesOf(node, key) {
  return some(
    node,
    (entry) => {
      const copied =
        entry.type === 'SpreadElement'
          ? [entry.argument]
          : entry.type === 'CallExpression' &&
              builtins.has(/^[^.]+/.exec(calleeKey(entry.callee))?.[0] ?? '')
            ? entry.arguments
            : [];
      return copied.some((argument) => {
        const value = unwrapped(argument);
        return (
          value?.type === 'CallExpression' && calleeKey(value.callee) === key
        );
      });
    },
    true,
  );
}

function looseness(assertion, scope) {
  const { matcher, negated, expected } = assertion;
  const [first] = expected;
  if (negated && throwMatchers.has(matcher))
    return `not.${matcher} of one error accepts almost any other outcome`;
  if (
    !negated &&
    matcher === 'toBeGreaterThanOrEqual' &&
    numberLiteral(first, [0])
  )
    return 'toBeGreaterThanOrEqual(0) accepts any count';
  if (negated && equalityMatchers.has(matcher) && literal(first))
    return 'it differs from a made-up value';
  if (matcher === 'toMatch' && matchesEmpty(first))
    return 'its pattern matches the empty string';
  if (builtFromActual(assertion, scope))
    return 'its expected value is built from its actual value';
  if (evaluatedAgain(assertion, scope))
    return 'its expected value is the same expression evaluated again';
  const produced = producingCall(assertion.actual, scope);
  const key = produced && calleeKey(produced.call.callee);
  if (key && expected.some((argument) => copiesOf(argument, key)))
    return `its expected value is a copy of another result of ${key}`;
  return undefined;
}

function judged(assertion, scope) {
  const permanent = permanentWeakness(assertion, scope);
  if (permanent) return { kind: 'weak', reason: permanent };
  if (
    some(
      assertion.actual,
      (node) =>
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        propertyOf(node.callee) === 'split',
    )
  )
    return {
      kind: 'conditional',
      reason: 'its actual value is a fragment cut from a text',
    };
  const shape = emptiness(assertion);
  if (shape)
    return {
      kind: 'conditional',
      reason: `${assertion.negated ? 'not.' : ''}${assertion.matcher} checks only ${shape === 'absence' ? 'an absence' : 'that something is there'}`,
    };
  const same = identity(assertion, scope);
  if (same)
    return {
      kind: 'conditional',
      reason: `it compares two results of ${same}`,
      keys: new Set([same]),
    };
  const loose = looseness(assertion, scope);
  if (loose) return { kind: 'weak', reason: loose };
  return { kind: 'strong' };
}

function rowsOf(call, body) {
  const callee = call.callee;
  if (
    callee.type !== 'CallExpression' ||
    callee.callee.type !== 'MemberExpression'
  )
    return new Set();
  const modifier = propertyOf(callee.callee);
  if (modifier === 'each')
    return new Set(body.params.flatMap((param) => patternNames(param, [])));
  if (modifier === 'for') return new Set(patternNames(body.params[0], []));
  return new Set();
}

function readIdentifier(node) {
  const parent = node.parent;
  if (parent?.type === 'MemberExpression' && parent.property === node)
    return parent.computed;
  return !(
    parent?.type === 'Property' &&
    parent.key === node &&
    !parent.computed &&
    parent.value !== node
  );
}

function readsRow(node, scope, rows, seen = new Set()) {
  return some(
    node,
    (entry) => {
      if (entry.type !== 'Identifier' || !readIdentifier(entry)) return false;
      if (rows.has(entry.name)) return true;
      const binding = scope.bindings.get(entry.name);
      if (seen.has(entry.name) || !binding?.local || !binding.init)
        return false;
      return readsRow(
        binding.init,
        scope,
        rows,
        new Set([...seen, entry.name]),
      );
    },
    true,
  );
}

function actsOnRow(body, scope, rows) {
  return (body.body.type === 'BlockStatement' ? body.body.body : []).some(
    (statement) =>
      !some(
        statement,
        (node) => node.type === 'CallExpression' && expectEntry(node),
        true,
      ) && readsRow(statement, scope, rows),
  );
}

function ignoresRow(assertion, scope, rows) {
  if (rows.size === 0) return false;
  const produced = producingCall(assertion.actual, scope);
  const callee = produced?.call.callee;
  const binding =
    callee?.type === 'Identifier' ? scope.bindings.get(callee.name) : undefined;
  if (binding?.kind !== 'import' || !String(binding.source).startsWith('.'))
    return false;
  return ![assertion.actual, ...assertion.expected].some((node) =>
    readsRow(node, scope, rows),
  );
}

function localFunctions(program) {
  const functions = new Map();
  walk(program, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id)
      functions.set(node.id.name, node);
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      isFunction(node.init)
    )
      functions.set(node.id.name, node.init);
  });
  return functions;
}

function assertionsIn(body, functions, visited = new Set([body])) {
  const found = [];
  walk(body, (node) => {
    if (node.type !== 'CallExpression') return;
    const assertion = assertionAt(node);
    if (assertion) found.push({ assertion, owner: body });
    const called =
      node.callee.type === 'Identifier'
        ? functions.get(node.callee.name)
        : undefined;
    if (called && !visited.has(called)) {
      visited.add(called);
      found.push(...assertionsIn(called, functions, visited));
    }
  });
  return found;
}

export function hollowTests(program, sourceCode, { spec }) {
  const functions = localFunctions(program);
  const reports = [];
  const scopes = new Map();
  const scopeFor = (owner) => {
    if (!scopes.has(owner))
      scopes.set(owner, scopeOf(program, owner, sourceCode));
    return scopes.get(owner);
  };
  const cases = [];
  walk(program, (node) => {
    if (node.type !== 'CallExpression') return;
    const body = caseBody(node);
    if (!body) return;
    const assertions = assertionsIn(body, functions);
    const report = node.arguments[0] ?? node;
    const matcherless = assertions.filter(
      ({ assertion }) => assertion.matcher === undefined,
    );
    if (matcherless.length > 0) {
      if (!spec)
        for (const { assertion } of matcherless)
          reports.push({
            node: assertion.call,
            message:
              'Call a matcher such as toEqual, because expect(actual) alone asserts nothing.',
          });
      return;
    }
    if (assertions.length === 0) {
      reports.push({
        node: report,
        message:
          'A test asserts at least once; this one makes no assertion, so it passes whatever the code does.',
      });
      return;
    }
    const rows = rowsOf(node, body);
    const fixed = rows.size > 0 && !actsOnRow(body, scopeFor(body), rows);
    cases.push({
      report,
      verdicts: assertions.map(({ assertion, owner }) => {
        const scope = scopeFor(owner);
        const verdict = judged(assertion, scope);
        return {
          ...verdict,
          assertion,
          keys: verdict.keys ?? subjects(assertion, scope, owner),
          ignoresRow:
            fixed &&
            verdict.kind === 'strong' &&
            owner === body &&
            ignoresRow(assertion, scope, rows),
        };
      }),
    });
  });
  const concrete = new Set();
  for (const { verdicts } of cases)
    for (const verdict of verdicts)
      if (verdict.kind === 'strong' && !verdict.ignoresRow)
        for (const key of verdict.keys) concrete.add(key);
  for (const { report, verdicts } of cases) {
    for (const verdict of verdicts)
      if (verdict.ignoresRow)
        reports.push({
          node: verdict.assertion.call,
          message:
            'This assertion reads nothing from the row of its it.each, so every row repeats the same check; assert it once in the test that states that behaviour.',
        });
    if (
      verdicts.some(
        (verdict) => verdict.kind === 'strong' && !verdict.ignoresRow,
      )
    )
      continue;
    const unproven = verdicts.filter(
      (verdict) =>
        verdict.kind === 'conditional' &&
        ![...verdict.keys].some((key) => concrete.has(key)),
    );
    const weak = verdicts.filter((verdict) => verdict.kind === 'weak');
    if (weak.length === 0 && unproven.length === 0) continue;
    if (weak.length === 0) {
      const named = [
        ...new Set(unproven.flatMap((verdict) => [...verdict.keys])),
      ];
      reports.push({
        node: report,
        message: `This test asserts only absences, identities or fragments (${[...new Set(unproven.map((verdict) => verdict.reason))].join('; ')}), and no test in this file asserts a concrete value produced by ${named.length > 0 ? named.join(', ') : 'its subject'}; assert what the subject produces for a valid input somewhere in this file, because an absence check cannot prove a concrete result.`,
      });
      continue;
    }
    reports.push({
      node: report,
      message: `Every assertion in this test could pass for a defect (${[...new Set(verdicts.filter((verdict) => verdict.kind !== 'strong').map((verdict) => verdict.reason))].join('; ')}); assert the exact value the code under test must produce, because these assertions cannot distinguish a defective result.`,
    });
  }
  return reports;
}
