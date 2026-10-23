import { build } from 'esbuild';
import { Schema } from 'effect';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const mobileRoot = fileURLToPath(new URL('..', import.meta.url));
const tools = [
  'views/development-settings.tsx',
  'views/development-pair-environment-form.tsx',
  'commands/development-pairing.ts',
  'features/access/api.ts',
  'features/development-catalog/index.ts',
];

it('excludes every development module from the production Android router export', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-release-bundle-'));
  try {
    await promisify(execFile)(
      join(mobileRoot, 'node_modules/.bin/expo'),
      [
        'export',
        '--platform',
        'android',
        '--no-bytecode',
        '--source-maps',
        '--max-workers',
        '2',
        '--output-dir',
        directory,
      ],
      {
        cwd: mobileRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          CI: '1',
          EXPO_PUBLIC_PORCELAIN_DEV_PAIR_URL: 'http://10.0.2.2:4738',
        },
      },
    );
    const files = await readdir(directory, { recursive: true });
    const maps = files.filter((path) => path.endsWith('.js.map'));
    expect(maps).toHaveLength(1);
    const sourceMap = Schema.decodeUnknownSync(
      Schema.fromJsonString(
        Schema.Struct({
          sections: Schema.Array(
            Schema.Struct({
              map: Schema.Struct({
                sources: Schema.Array(Schema.String),
                mappings: Schema.String,
              }),
            }),
          ),
        }),
      ),
    )(await readFile(join(directory, maps[0]!), 'utf8'));
    const modules = sourceMap.sections
      .filter(({ map }) => /[A-Za-z0-9+/]/.test(map.mappings))
      .flatMap(({ map }) => map.sources);
    expect(modules).toContain(
      '/apps/mobile/src/features/access/views/settings-screen.tsx',
    );
    expect(
      modules.filter(
        (path) =>
          /\/(?:apps|packages)\//.test(path) &&
          (/\/development-[^/]+/.test(path) ||
            path.includes('/features/catalog/')),
      ),
    ).toEqual([]);
    const bundle = await readFile(
      join(directory, maps[0]!.slice(0, -4)),
      'utf8',
    );
    expect(bundle).not.toContain('Explore Text');
    expect(bundle).not.toContain('Wrapping and selection');
    expect(bundle).not.toContain('Use development server');
    expect(bundle).toContain('Pair a computer');
    expect(bundle).toContain('Reviews & Git');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 180_000);

it.each(
  ['ios', 'android'].flatMap((platform) =>
    [false, true].flatMap((development) =>
      ['', 'http://10.0.2.2:4738'].map((pairingUrl) => ({
        platform,
        development,
        pairingUrl,
      })),
    ),
  ),
)(
  '$platform includes development tools only in development ($development, $pairingUrl)',
  async ({ platform, development, pairingUrl }) => {
    const result = await build({
      absWorkingDir: mobileRoot,
      entryPoints: [
        'src/features/access/views/settings-screen.tsx',
        'src/features/access/views/pair-environment-form.tsx',
        'src/app/(settings)/component-library.tsx',
        'src/app/(settings)/component-text.tsx',
        'src/app/(settings)/component-button.tsx',
        'src/app/(settings)/component-preview.tsx',
        ...(platform === 'ios' ? ['src/shell/tablet-settings.ios.tsx'] : []),
      ],
      bundle: true,
      packages: 'external',
      platform: 'neutral',
      format: 'esm',
      outdir: 'bundle-test',
      write: false,
      metafile: true,
      define: {
        __DEV__: String(development),
        'process.env.EXPO_PUBLIC_PORCELAIN_DEV_PAIR_URL':
          JSON.stringify(pairingUrl),
      },
      resolveExtensions: [
        `.${platform}.tsx`,
        `.${platform}.ts`,
        '.tsx',
        '.ts',
        '.js',
      ],
    });
    const inputs = Object.keys(result.metafile.inputs);
    const output = result.outputFiles.map((file) => file.text).join('\n');
    expect(
      tools.map((tool) => inputs.some((path) => path.endsWith(tool))),
    ).toEqual(
      development
        ? [true, true, true, true, true]
        : [false, false, false, false, false],
    );
    expect(output.includes('Component library')).toBe(development);
    expect(output.includes('Use development server')).toBe(development);
    expect(
      output.includes('The development pairing helper is unavailable.'),
    ).toBe(development);
    expect(output).toContain('Pair a computer');
    expect(output).toContain('Try again');
    expect(output).toContain('Reviews & Git');
  },
);
