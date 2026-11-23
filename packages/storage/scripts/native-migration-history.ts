import { parseSync } from 'oxc-parser';

type Migration = {
  id: number;
  name: string;
  body: string;
};

function entries(source: string): Migration[] | undefined {
  const parsed = parseSync('migrate.ts', source);
  if (parsed.errors.length > 0) return undefined;
  for (const statement of parsed.program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    )
      continue;
    const declaration = statement.declaration.declarations.find(
      ({ id }) => id.type === 'Identifier' && id.name === 'nativeMigrations',
    );
    if (!declaration) continue;
    const initializer = declaration.init;
    if (
      initializer?.type !== 'CallExpression' ||
      initializer.callee.type !== 'MemberExpression' ||
      initializer.callee.object.type !== 'Identifier' ||
      initializer.callee.object.name !== 'Migrator' ||
      initializer.callee.property.type !== 'Identifier' ||
      initializer.callee.property.name !== 'fromRecord' ||
      initializer.callee.computed ||
      initializer.arguments.length !== 1 ||
      initializer.arguments[0]?.type !== 'ObjectExpression'
    )
      return undefined;
    const migrations: Migration[] = [];
    const ids = new Set<number>();
    for (const property of initializer.arguments[0].properties) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.key.type !== 'Literal' ||
        typeof property.key.value !== 'string'
      )
        return undefined;
      const name = property.key.value;
      const match = /^(\d{3,})_[a-z0-9_]+$/.exec(name);
      if (!match) return undefined;
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id) || ids.has(id)) return undefined;
      ids.add(id);
      migrations.push({
        id,
        name,
        body: source.slice(property.value.start, property.value.end),
      });
    }
    return migrations;
  }
  return undefined;
}

export function nativeMigrationHistoryProblems(
  shippedSource: string,
  currentSource: string,
): string[] {
  const shipped = entries(shippedSource);
  const current = entries(currentSource);
  if (shipped === undefined || current === undefined)
    return [
      'Keep nativeMigrations as a static Migrator.fromRecord registry with unique numbered migrations.',
    ];
  const problems: string[] = [];
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const shippedIds = new Set(shipped.map((entry) => entry.id));
  const lastShipped = Math.max(0, ...shippedIds);
  for (const migration of shipped) {
    const found = currentById.get(migration.id);
    if (found?.name !== migration.name)
      problems.push(
        `Shipped native migration removed or renamed: ${migration.name}.`,
      );
    else if (found.body !== migration.body)
      problems.push(`Shipped native migration edited: ${migration.name}.`);
  }
  for (const migration of current) {
    if (migration.id <= lastShipped && !shippedIds.has(migration.id))
      problems.push(
        `Native migration added inside shipped history: ${migration.name}. Use a new migration number.`,
      );
  }
  return problems;
}
