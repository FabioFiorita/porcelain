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
]);
const assertionEntries = new Set(['soft', 'poll', 'element']);
const weakMatchers = new Set(['toBeDefined', 'toBeTruthy', 'toBeInstanceOf']);
const negatedWeakMatchers = new Set([
  'toThrow',
  'toThrowError',
  'toBeUndefined',
  'toBeNull',
  'toBeFalsy',
  'toBeDefined',
]);
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

function weakness(assertion, scope) {
  const { matcher, negated, expected, actual } = assertion;
  const [first] = expected;
  if (mockMatcher.test(matcher)) return `${matcher} checks only a mock`;
  if (!negated && weakMatchers.has(matcher))
    return `${matcher} accepts almost any value`;
  if (!negated && matcher === 'toBeUndefined')
    return 'toBeUndefined checks only an absence';
  if (negated && negatedWeakMatchers.has(matcher))
    return `not.${matcher} accepts almost any value`;
  if (
    !negated &&
    ((matcher === 'toBeGreaterThan' && numberLiteral(first, [0])) ||
      (matcher === 'toBeGreaterThanOrEqual' && numberLiteral(first, [0, 1])))
  )
    return `${matcher}(${first.value}) accepts almost any count`;
  if (matcher === 'toHaveLength' && numberLiteral(first, [0]))
    return negated
      ? 'not.toHaveLength(0) accepts almost any value'
      : 'toHaveLength(0) checks only an absence';
  if (
    negated &&
    equalityMatchers.has(matcher) &&
    first?.type === 'ArrayExpression' &&
    first.elements.length === 0
  )
    return `not.${matcher}([]) accepts almost any value`;
  if (
    !negated &&
    equalityMatchers.has(matcher) &&
    first?.type === 'ArrayExpression' &&
    first.elements.length === 0
  )
    return `${matcher}([]) checks only an absence`;
  if (negated && equalityMatchers.has(matcher) && literal(first))
    return 'it differs from a made-up value';
  if (matcher === 'toMatch' && matchesEmpty(first))
    return 'its pattern matches the empty string';
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
  if (
    some(
      actual,
      (node) =>
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        propertyOf(node.callee) === 'split',
    )
  )
    return 'its actual value is a fragment cut from a text';
  if (builtFromActual(assertion, scope))
    return 'its expected value is built from its actual value';
  if (evaluatedAgain(assertion, scope))
    return 'its expected value is the same expression evaluated again';
  if (builtByTest(actual, scope))
    return 'its actual value is a value the test built itself';
  return undefined;
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
              'Name the matcher: expect(actual) asserts nothing until a matcher such as toEqual is called on it.',
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
    const scopes = new Map();
    const reasons = [];
    for (const { assertion, owner } of assertions) {
      if (!scopes.has(owner))
        scopes.set(owner, scopeOf(program, owner, sourceCode));
      const reason = weakness(assertion, scopes.get(owner));
      if (reason === undefined) return;
      reasons.push(reason);
    }
    reports.push({
      node: report,
      message: `Every assertion in this test could pass for a defect (${[...new Set(reasons)].join('; ')}); assert the exact value the code under test must produce, read from it.`,
    });
  });
  return reports;
}
