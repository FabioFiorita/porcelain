import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { sweep } from '../../web-verify/scripts/sweep.ts';
import { registry } from '../../web-verify/scripts/instance.ts';
import { runCli } from '../../verify-core/cli.ts';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const capture: NonNullable<Parameters<typeof sweep>[2]> = async (
  _signed,
  url,
  shot,
  file,
) => {
  await writeFile(file, onePixelPng);
  shot.file = file;
  if (url.pathname === '/sweep-error.html') {
    if (shot.theme === 'light') {
      if (shot.width === 1440)
        shot.problems.push('page error: sweep fixture page error');
      if (shot.width === 1080)
        shot.problems.push('console error: sweep fixture console error');
      if (shot.width === 414)
        shot.problems.push(
          'overflows horizontally: 2000 px of content in 414 px (<div> "Too wide" ends at 2000 px)',
        );
    } else if (shot.width === 414)
      shot.problems.push(
        'console error: Target crashed: the review socket has been closed',
      );
  }
  if (url.pathname === '/sweep-unavailable.html')
    shot.problems.push(
      `unavailable page: ${shot.theme === 'light' ? 'Page not found' : 'Computer unavailable'}`,
    );
};
if (import.meta.main)
  await runCli(async () => {
    const args = process.argv.slice(2);
    const { values } = parseArgs({
      args,
      options: {
        instance: { type: 'string' },
        board: { type: 'string', multiple: true },
      },
      allowPositionals: true,
    });
    const instance = registry.chosen(values.instance);
    return registry.drive(instance, args, () => sweep(instance, args, capture));
  });
