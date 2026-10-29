import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { boards } from './board-maps.ts';
import { Usage } from '../../verify-core/cli.ts';

export type Theme = 'light' | 'dark';

export function boardDiffOptions(args: readonly string[]) {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    options: {
      instance: { type: 'string' },
      board: { type: 'string' },
      route: { type: 'string' },
      width: { type: 'string', default: '1440,414' },
      theme: { type: 'string', default: 'light,dark' },
      'board-directory': { type: 'string' },
    },
  });
  if (
    positionals.length !== 1 ||
    positionals[0] !== 'board-diff' ||
    !values.board ||
    !values.route
  )
    throw new Usage(
      'board-diff requires --board <name> and --route <app route>.',
    );
  const name = values.board;
  const route = values.route;
  if (
    !route.startsWith('/') ||
    route.startsWith('//') ||
    new URL(route, 'http://localhost').origin !== 'http://localhost'
  )
    throw new Usage('--route must be a path on the running app.');
  const widths = values.width.split(',').map(Number);
  if (
    widths.length === 0 ||
    widths.some(
      (width) => !Number.isInteger(width) || width < 320 || width > 3840,
    )
  )
    throw new Usage(
      '--width takes comma-separated integer widths from 320 to 3840.',
    );
  const themes = values.theme.split(',').map((theme): Theme => {
    if (theme !== 'light' && theme !== 'dark')
      throw new Usage('--theme takes light,dark.');
    return theme;
  });
  const board =
    (Object.hasOwn(boards, name) ? boards[name] : undefined) ??
    Object.values(boards).find(
      (map) => map.html === `${name.replace(/\.html$/, '')}.html`,
    );
  if (board === undefined)
    throw new Usage(
      `Unknown board ${values.board}. Choose ${Object.keys(boards).join(', ')}.`,
    );
  const directory =
    values['board-directory'] ?? process.env.PORCELAIN_BOARD_DIRECTORY;
  if (!directory)
    throw new Usage(
      'Set PORCELAIN_BOARD_DIRECTORY or pass --board-directory <folder> containing the approved HTML boards.',
    );
  const html = resolve(directory, board.html);
  if (!existsSync(html)) throw new Usage(`Board HTML is missing: ${html}`);
  return {
    name,
    board,
    directory: resolve(directory),
    route,
    widths: [...new Set(widths)],
    themes: [...new Set(themes)],
  };
}
