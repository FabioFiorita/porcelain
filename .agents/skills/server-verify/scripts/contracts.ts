import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRecord, record } from './feature.ts';

const manifest = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/contracts/package.json',
);

function isSchema(value: unknown): value is object {
  return (
    typeof value === 'object' &&
    value !== null &&
    'safeParse' in value &&
    typeof value.safeParse === 'function'
  );
}

export async function contractSchemas(): Promise<ReadonlySet<unknown>> {
  const areas = Object.keys(
    record(record(JSON.parse(await readFile(manifest, 'utf8'))).exports),
  );
  const schemas = new Set<unknown>();
  for (const area of areas) {
    const loaded: unknown = await import(
      `@porcelain/contracts/${area.replace(/^\.\//, '')}`
    );
    if (isRecord(loaded))
      for (const value of Object.values(loaded))
        if (isSchema(value)) schemas.add(value);
  }
  return schemas;
}
