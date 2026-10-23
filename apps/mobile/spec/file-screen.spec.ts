import { readFile } from 'node:fs/promises';
import { parseSync } from 'oxc-parser';
import { expect, it } from 'vitest';

it('opens known file paths through text and asset readers without a parent-directory prerequisite', async () => {
  const path = new URL(
    '../src/features/files/views/file-screen.tsx',
    import.meta.url,
  );
  const source = await readFile(path, 'utf8');
  const parsed = parseSync(path.pathname, source, { lang: 'tsx' });
  const queries = parsed.program.body.flatMap((statement) =>
    statement.type === 'ImportDeclaration' &&
    statement.source.value.startsWith('../queries/')
      ? [statement.source.value]
      : [],
  );

  expect(queries.sort()).toEqual(['../queries/asset', '../queries/text']);
});
