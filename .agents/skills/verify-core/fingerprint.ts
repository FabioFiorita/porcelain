import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
export type BuildInputs = {
  roots: readonly string[];
  apps: readonly string[];
};
const serverInputs: BuildInputs = {
  roots: [
    'apps/server/src',
    'apps/server/spec/kit',
    'apps/server/spec/fakes',
    'packages/storage/drizzle',
    'pnpm-lock.yaml',
  ],
  apps: ['apps/server'],
};
const skipped = new Set(['node_modules', 'dist', '.turbo', 'test-results']);
const testFile = /\.(?:spec|test|e2e|integration|perf)\.tsx?$/;
const manifestSchema = Schema.Struct({
  name: Schema.String,
  dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  devDependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});
function filesOf(root: string, path: string): string[] {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return [path];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    skipped.has(entry.name) || (entry.isFile() && testFile.test(entry.name))
      ? []
      : filesOf(root, join(path, entry.name)),
  );
}
export function hashOf(root: string, paths: readonly string[]): string {
  const hash = createHash('sha256');
  for (const file of [
    ...new Set(paths.flatMap((path) => filesOf(root, path))),
  ].toSorted()) {
    const { size, mtimeMs } = statSync(join(root, file));
    hash.update(`${file}\0${size}\0${mtimeMs}\n`);
  }
  return hash.digest('hex');
}
function manifest(root: string, folder: string) {
  return Schema.decodeUnknownSync(manifestSchema)(
    JSON.parse(readFileSync(join(root, folder, 'package.json'), 'utf8')),
  );
}
function workspacePackages(root: string, apps: readonly string[]): string[] {
  const folders = new Map(
    readdirSync(join(root, 'packages'), { withFileTypes: true })
      .filter((entry) =>
        existsSync(join(root, 'packages', entry.name, 'package.json')),
      )
      .map((entry) => {
        const folder = join('packages', entry.name);
        return [manifest(root, folder).name, folder] as const;
      }),
  );
  const found = new Set<string>();
  const visit = (folder: string) => {
    const { dependencies = {}, devDependencies = {} } = manifest(root, folder);
    for (const [name, version] of Object.entries({
      ...dependencies,
      ...devDependencies,
    })) {
      const dependency = folders.get(name);
      if (!version.startsWith('workspace:') || dependency === undefined)
        continue;
      if (found.has(dependency)) continue;
      found.add(dependency);
      visit(dependency);
    }
  };
  for (const app of apps) visit(app);
  return [...found].map((folder) => join(folder, 'src'));
}
export function buildFingerprint(
  root: string,
  surface: BuildInputs,
  cliFolders: readonly string[],
): string {
  const apps = [...serverInputs.apps, ...surface.apps];
  return hashOf(root, [
    ...serverInputs.roots,
    ...surface.roots,
    ...workspacePackages(root, apps),
    ...cliFolders.map((folder) => relative(root, folder)),
  ]);
}
