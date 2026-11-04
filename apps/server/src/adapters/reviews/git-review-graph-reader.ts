import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { cruise } from 'dependency-cruiser';
import { Effect, FileSystem, Layer, Schema } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { readModuleSnapshot } from '@porcelain/git/inspection';
import { ReviewGraphReader } from '@porcelain/reviews/ports';
import { join, dirname, relative, isAbsolute, resolve } from 'node:path';
import type { Limits } from '../../config/limits.ts';

const resolutionSchema = Schema.Struct({
  options: Schema.Struct({
    baseUrl: Schema.optional(Schema.String),
    pathsBasePath: Schema.optional(Schema.String),
    paths: Schema.optional(
      Schema.Record(Schema.String, Schema.Array(Schema.String)),
    ),
  }),
});
const manifestSchema = Schema.Struct({ name: Schema.optional(Schema.String) });
export const gitReviewGraphReaderLayer = (limits: Limits) =>
  Layer.effect(
    ReviewGraphReader,
    Effect.gen(function* () {
      const git = yield* captureGitPlatform();
      const fs = yield* FileSystem.FileSystem;
      return ReviewGraphReader.of({
        read: Effect.fn('ReviewGraphReader.read')(function* (input) {
          return yield* Effect.scoped(
            Effect.gen(function* () {
              const files = yield* git(readModuleSnapshot(input, limits.git));
              const root = yield* fs.makeTempDirectoryScoped();
              for (const file of files) {
                const destination = join(root, file.path);
                yield* fs.makeDirectory(dirname(destination), {
                  recursive: true,
                });
                yield* fs.writeFileString(destination, file.text);
              }
              for (const file of files.filter((file) =>
                file.path.endsWith('package.json'),
              )) {
                const manifest = yield* Schema.decodeUnknownEffect(
                  Schema.fromJsonString(manifestSchema),
                )(file.text).pipe(
                  Effect.orElseSucceed(() => ({ name: undefined })),
                );
                if (
                  !manifest.name ||
                  !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(manifest.name) ||
                  manifest.name
                    .split('/')
                    .some((part) => part === '.' || part === '..')
                )
                  continue;
                const link = join(root, 'node_modules', manifest.name);
                yield* fs.makeDirectory(dirname(link), { recursive: true });
                yield* fs
                  .symlink(dirname(join(root, file.path)), link)
                  .pipe(Effect.orElseSucceed(() => undefined));
              }
              const paths = new Set(files.map((file) => file.path));
              const packages = files
                .filter((file) => file.path.endsWith('package.json'))
                .map((file) => dirname(file.path))
                .sort((a, b) => b.length - a.length);
              const sources = files
                .filter((file) => /\.[cm]?[jt]sx?$/.test(file.path))
                .map((file) => join(root, file.path));
              if (sources.length === 0) return [];
              const configs = files
                .filter((file) => file.path.endsWith('tsconfig.json'))
                .map((file) => file.path)
                .sort((a, b) => b.length - a.length);
              const groups = new Map<string, string[]>();
              for (const source of sources) {
                const sourcePath = relative(root, source);
                const config =
                  configs.find((config) =>
                    sourcePath.startsWith(dirname(config) + '/'),
                  ) ?? (paths.has('tsconfig.json') ? 'tsconfig.json' : '');
                groups.set(config, [...(groups.get(config) ?? []), source]);
              }
              const modules = [];
              for (const [config, group] of groups) {
                const tsConfig = config
                  ? yield* Effect.try(() =>
                      extractTSConfig(join(root, config)),
                    ).pipe(Effect.orElseSucceed(() => undefined))
                  : undefined;
                const resolution = tsConfig
                  ? yield* Schema.decodeUnknownEffect(resolutionSchema)(
                      tsConfig,
                    )
                  : undefined;
                const aliases = Object.fromEntries(
                  Object.entries(resolution?.options.paths ?? {}).map(
                    ([key, targets]) => [
                      key,
                      targets.map((target) =>
                        resolve(
                          resolution?.options.baseUrl ??
                            resolution?.options.pathsBasePath ??
                            dirname(join(root, config)),
                          target,
                        ),
                      ),
                    ],
                  ),
                );
                const result = yield* Effect.tryPromise(() =>
                  cruise(
                    group,
                    {

                      tsPreCompilationDeps: true,
                      preserveSymlinks: false,
                      doNotFollow: { path: 'node_modules' },
                      exclude: 'node_modules',
                      enhancedResolveOptions: {
                        exportsFields: ['exports'],
                        conditionNames: ['import', 'node', 'default'],
                        extensions: [
                          '.ts',
                          '.tsx',
                          '.mts',
                          '.cts',
                          '.js',
                          '.jsx',
                          '.mjs',
                          '.cjs',
                          '.json',
                        ],
                      },
                    },
                    { alias: aliases },
                    { tsConfig },
                  ),
                );
                if (typeof result.output === 'string') return undefined;
                const own = new Set(
                  group.map((source) => relative(root, source)),
                );
                modules.push(
                  ...result.output.modules.filter((module) =>
                    own.has(
                      paths.has(module.source)
                        ? module.source
                        : relative(root, resolve(module.source)),
                    ),
                  ),
                );
              }
              const local = (path: string) =>
                isAbsolute(path)
                  ? relative(root, path).replaceAll('\\', '/')
                  : paths.has(path)
                    ? path
                    : relative(root, resolve(path)).replaceAll('\\', '/');
              return modules
                .filter((module) => paths.has(local(module.source)))
                .map((module) => ({
                  path: local(module.source),
                  owner:
                    local(module.source).match(
                      /^(.*?\/features\/[^/]+)/,
                    )?.[1] ??
                    packages.find((path) =>
                      local(module.source).startsWith(path + '/'),
                    ) ??
                    (dirname(local(module.source)) || '.'),
                  imports: module.dependencies
                    .filter((dependency) =>
                      paths.has(local(dependency.resolved)),
                    )
                    .map((dependency) => local(dependency.resolved))
                    .sort(),
                  unresolved: module.dependencies.filter(
                    (dependency) =>
                      dependency.couldNotResolve &&
                      dependency.module.startsWith('.'),
                  ).length,
                }));
            }),
          ).pipe(
            Effect.tapError((error) =>
              Effect.logWarning(
                `Review import graph unavailable: ${String(error)} ${String(error.cause)}`,
              ),
            ),
            Effect.orElseSucceed(() => undefined),
          );
        }),
      });
    }),
  );
