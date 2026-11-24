import { join } from 'node:path';
import type { Statement } from 'effect/sql';
import { TypeFlags, type Project, type Type } from 'typescript/sync';
import type {
  Expression,
  Node,
  TaggedTemplateExpression,
} from 'typescript/ast';
import {
  isArrayLiteralExpression,
  isCallExpression,
  isElementAccessExpression,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
  isTaggedTemplateExpression,
} from 'typescript/ast/is';

import {
  descendants,
  readTypeScriptProjects,
  sourceLocation,
} from './typescript-project.ts';
import type { RepositoryQuery } from '../packages/storage/spec/kit/repository-queries.ts';

function isSqlConstructor(type: Type | undefined) {
  return (
    type?.getProperty('unsafe') !== undefined &&
    type.getProperty('insert') !== undefined &&
    type.getProperty('update') !== undefined
  );
}

function literalString(node: Node | undefined) {
  if (node && isStringLiteral(node)) return node.text;
  throw new Error(
    'Use a literal string for the SQL identifier or omitted column',
  );
}

function rowShape(project: Project, node: Expression | undefined) {
  const type = node && project.checker.getTypeAtLocation(node);
  const fields = type?.getProperties().map((field) => field.name);
  if (
    !fields?.length ||
    type?.isUnionType() ||
    type?.getCallSignatures().length ||
    type?.getStringIndexType() ||
    type?.getNumberIndexType()
  )
    throw new Error(
      'Use a row with a fixed set of named fields for SQL insert or update',
    );
  return Object.fromEntries<unknown>(fields.map((field) => [field, 0]));
}

function interpolation(
  project: Project,
  sql: Statement.Constructor,
  expression: Expression,
  checked: Set<Node>,
): unknown {
  if (
    isCallExpression(expression) &&
    isPropertyAccessExpression(expression.expression) &&
    isSqlConstructor(
      project.checker.getTypeAtLocation(expression.expression.expression),
    )
  ) {
    const method = expression.expression.name.text;
    const [first, second] = expression.arguments;
    checked.add(expression.expression);
    switch (method) {
      case 'in':
        return second ? sql.in(literalString(first), [0]) : sql.in([0]);
      case 'insert':
        return sql.insert(rowShape(project, first));
      case 'update': {
        if (second && !isArrayLiteralExpression(second))
          throw new Error('Use a literal list for omitted SQL update columns');
        return sql.update(
          rowShape(project, first),
          second?.elements.map(literalString),
        );
      }
      default:
        throw new Error(`Unsupported SQL interpolation ${method}`);
    }
  }
  const type = project.checker.getTypeAtLocation(expression);
  const variants = type?.isUnionType() ? type.getTypes() : type ? [type] : [];
  if (
    variants.some(
      (variant) =>
        (variant.flags &
          (TypeFlags.Any | TypeFlags.Unknown | TypeFlags.TypeParameter)) !==
          0 ||
        variant
          .getProperties()
          .some(
            (field) =>
              field.name.includes('FragmentTypeId') ||
              field.name.includes('SegmentTypeId'),
          ),
    )
  )
    throw new Error('Put SQL helpers directly inside the query template');
  return 0;
}

function compileQuery(
  project: Project,
  sql: Statement.Constructor,
  { template }: TaggedTemplateExpression,
  checked: Set<Node>,
) {
  if (isNoSubstitutionTemplateLiteral(template))
    return sql(
      Object.assign([template.text], { raw: [template.text] }),
    ).compile()[0];

  const parts = [template.head.text];
  const args = [];
  for (const span of template.templateSpans) {
    parts.push(span.literal.text);
    args.push(interpolation(project, sql, span.expression, checked));
  }
  return sql(Object.assign(parts, { raw: parts }), ...args).compile()[0];
}

export function repositoryQueries(root: string, sql: Statement.Constructor) {
  const config = join(root, 'packages/storage/tsconfig.json');
  return readTypeScriptProjects(root, [config], (project) => {
    const directory = join(root, 'packages/storage/src/repositories') + '/';
    const queries: RepositoryQuery[] = [];
    for (const name of project.program.getSourceFileNames()) {
      if (!name.startsWith(directory) || name.endsWith('.spec.ts')) continue;
      const file = project.program.getSourceFile(name);
      if (!file) throw new Error(`TypeScript did not load ${name}`);
      const checked = new Set<Node>();
      for (const node of descendants(file)) {
        try {
          if (
            isTaggedTemplateExpression(node) &&
            isSqlConstructor(project.checker.getTypeAtLocation(node.tag))
          ) {
            queries.push({
              location: sourceLocation(root, node),
              text: compileQuery(project, sql, node, checked).trim(),
            });
          }
          if (
            (isPropertyAccessExpression(node) ||
              isElementAccessExpression(node)) &&
            !checked.has(node) &&
            !(
              isPropertyAccessExpression(node) &&
              node.name.text === 'withTransaction'
            ) &&
            isSqlConstructor(project.checker.getTypeAtLocation(node.expression))
          )
            throw new Error(
              'Use a SQL template and inline SQL helpers so SQLite can check the query',
            );
          if (
            isCallExpression(node) &&
            isSqlConstructor(project.checker.getTypeAtLocation(node.expression))
          )
            throw new Error('Use a SQL template so SQLite can check the query');
        } catch (error) {
          throw new Error(`${sourceLocation(root, node)}: ${String(error)}`, {
            cause: error,
          });
        }
      }
    }
    return queries;
  });
}
