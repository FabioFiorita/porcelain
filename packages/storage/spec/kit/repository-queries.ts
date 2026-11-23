import type { DatabaseSync } from 'node:sqlite';

export type RepositoryQuery = { location: string; text: string };

export function prepareRepositoryQueries(
  database: DatabaseSync,
  queries: readonly RepositoryQuery[],
): string[] {
  const problems: string[] = [];
  for (const { location, text } of queries) {
    try {
      const statement = database.prepare(text);
      if (statement.sourceSQL.trim() !== text)
        problems.push(`${location}: SQLite must prepare the entire query`);
    } catch (error) {
      problems.push(`${location}: ${String(error)}\n${text}`);
    }
  }
  return problems;
}
