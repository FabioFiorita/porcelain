import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const mobileRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtures = [
  'features/access/views/development-settings.tsx',
  'features/access/views/development-credentials.tsx',
  'features/access/commands/development-credentials.ts',
  'shared/adapters/development-credential-storage.ts',
];

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
  '$platform includes credential fixtures only in development ($development, $pairingUrl)',
  async ({ platform, development, pairingUrl }) => {
    const result = await build({
      absWorkingDir: mobileRoot,
      entryPoints: [
        'src/features/access/views/settings-screen.tsx',
        'src/shared/application/store.ts',
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
      fixtures.map((fixture) => inputs.some((path) => path.endsWith(fixture))),
    ).toEqual(
      development ? [true, true, true, true] : [false, false, false, false],
    );
    expect(
      [
        'EnvironmentStorage.removeDevelopmentCredential',
        'Credential fixtures require a disposable development profile.',
        'Only an emulator fixture credential can be removed.',
      ].map((marker) => output.includes(marker)),
    ).toEqual(development ? [true, true, true] : [false, false, false]);
    expect(output).toContain('EnvironmentStorage.readRoute');
    expect(output).toContain('A saved credential cannot be replaced.');
  },
);
