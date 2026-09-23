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

export default {
  meta: { name: 'porcelain' },
  rules: {
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
        if (
          !/\/packages\/(?:projects|changes|reviews|files|git-actions|access)\/src\/(?:services|models|policies)\//.test(
            path,
          )
        )
          return {};
        return {
          Literal(node) {
            if (node.value === null)
              context.report({
                node,
                message:
                  'Use a domain failure or an optional value; keep SQL and wire nulls at their boundaries.',
              });
          },
        };
      },
    },
    'type-only-controller-contracts': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (!/\/apps\/server\/src\/controllers\//.test(path)) return {};
        return {
          ImportDeclaration(node) {
            if (
              typeof node.source.value === 'string' &&
              node.source.value.startsWith('@porcelain/contracts') &&
              node.importKind !== 'type'
            )
              context.report({
                node,
                message:
                  'Controllers may import wire contract types, not runtime schemas.',
              });
          },
        };
      },
    },
    'no-schema-parse-in-typed-code': {
      create(context) {
        const path = normalizedFilename(context.filename);
        if (
          !/\/apps\/server\/src\/controllers\/|\/packages\/[^/]+\/src\/services\//.test(
            path,
          )
        )
          return {};
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== 'MemberExpression') return;
            const method = callee.computed
              ? callee.property.type === 'Literal'
                ? callee.property.value
                : undefined
              : callee.property.type === 'Identifier'
                ? callee.property.name
                : undefined;
            if (method !== 'parse' && method !== 'safeParse') return;
            context.report({
              node,
              message:
                'Typed controllers and services must use TypeScript; parse untrusted data at the transport boundary.',
            });
          },
        };
      },
    },
    'operation-class-shape': {
      create(context) {
        const role = operationRole(context.filename);
        if (!role) return {};
        const filename = normalizedFilename(context.filename).split('/').at(-1);
        const expectedName = filename
          .slice(0, -3)
          .split('-')
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join('');
        let found = 0;
        return {
          ExportNamedDeclaration(node) {
            const declaration = node.declaration;
            if (!declaration || declaration.type !== 'ClassDeclaration') return;
            if (declaration.id?.name !== expectedName) {
              context.report({
                node: declaration,
                message: `Name the exported class ${expectedName}.`,
              });
              return;
            }
            found += 1;
            const execute = declaration.body.body.filter(
              (member) =>
                member.type === 'MethodDefinition' &&
                member.key.type === 'Identifier' &&
                member.key.name === 'execute' &&
                member.kind === 'method' &&
                member.accessibility !== 'private' &&
                member.accessibility !== 'protected',
            );
            for (const member of declaration.body.body) {
              if (
                member.type !== 'MethodDefinition' ||
                member.kind === 'constructor' ||
                member.accessibility === 'private' ||
                member.accessibility === 'protected' ||
                (member.key.type === 'Identifier' &&
                  member.key.name === 'execute')
              )
                continue;
              context.report({
                node: member,
                message: `${role} classes expose only execute; make helpers private.`,
              });
            }
            if (execute.length !== 1)
              context.report({
                node: declaration,
                message: `${role} classes need one public execute method.`,
              });
            else if (!execute[0].value.returnType)
              context.report({
                node: execute[0],
                message:
                  'Declare the execute return type so the contract is visible to TypeScript.',
              });
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
        if (!/\/apps\/server\/src\/http\/routes\/[^/]+\/[^/]+\.ts$/.test(path))
          return {};
        let registrations = 0;
        let controllerCalls = 0;
        const contractSchemas = new Set();
        return {
          ImportDeclaration(node) {
            if (
              typeof node.source.value !== 'string' ||
              !node.source.value.startsWith('@porcelain/contracts/')
            )
              return;
            for (const specifier of node.specifiers) {
              if (
                specifier.type === 'ImportSpecifier' &&
                specifier.imported.type === 'Identifier' &&
                /Schema$/.test(specifier.imported.name)
              )
                contractSchemas.add(specifier.local.name);
            }
          },
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== 'MemberExpression' || callee.computed) return;
            if (
              callee.object.type === 'Identifier' &&
              callee.object.name === 'api' &&
              callee.property.type === 'Identifier' &&
              ['get', 'post', 'put', 'patch', 'delete'].includes(
                callee.property.name,
              )
            ) {
              registrations += 1;
              const options = node.arguments[1];
              const schema =
                options?.type === 'ObjectExpression'
                  ? options.properties.find(
                      (entry) =>
                        entry.type === 'Property' &&
                        entry.key.type === 'Identifier' &&
                        entry.key.name === 'schema',
                    )
                  : undefined;
              const response =
                schema?.value.type === 'ObjectExpression'
                  ? schema.value.properties.find(
                      (entry) =>
                        entry.type === 'Property' &&
                        entry.key.type === 'Identifier' &&
                        entry.key.name === 'response',
                    )
                  : undefined;
              const requestSchemas =
                schema?.value.type === 'ObjectExpression'
                  ? schema.value.properties.filter(
                      (entry) =>
                        entry.type === 'Property' &&
                        entry.key.type === 'Identifier' &&
                        ['params', 'body', 'querystring', 'headers'].includes(
                          entry.key.name,
                        ),
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
              if (
                node.arguments[0]?.type !== 'Literal' ||
                typeof node.arguments[0].value !== 'string' ||
                !response ||
                response.value.type !== 'ObjectExpression' ||
                node.arguments[2]?.type !== 'ArrowFunctionExpression' ||
                !requestSchemas.every(contractSchema) ||
                responseSchemas.length === 0 ||
                !responseSchemas.every(contractSchema)
              )
                context.report({
                  node,
                  message:
                    'A feature route needs a literal path, imported contract schemas for input and output, and one handler.',
                });
            }
            if (
              callee.property.type === 'Identifier' &&
              callee.property.name === 'execute' &&
              callee.object.type === 'MemberExpression' &&
              !callee.object.computed &&
              callee.object.object.type === 'Identifier' &&
              callee.object.object.name === 'options' &&
              callee.object.property.type === 'Identifier' &&
              callee.object.property.name === 'controller'
            )
              controllerCalls += 1;
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
