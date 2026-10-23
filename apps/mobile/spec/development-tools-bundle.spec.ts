import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const mobileRoot = fileURLToPath(new URL('..', import.meta.url));
const tools = [
  'views/development-settings.tsx',
  'views/development-pair-environment-form.tsx',
  'commands/development-pairing.ts',
  'features/access/api.ts',
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
  '$platform includes development tools only in development ($development, $pairingUrl)',
  async ({ platform, development, pairingUrl }) => {
    const result = await build({
      absWorkingDir: mobileRoot,
      entryPoints: [
        'src/features/access/views/settings-screen.tsx',
        'src/features/access/views/pair-environment-form.tsx',
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
      development ? [true, true, true, true] : [false, false, false, false],
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
