import { readFileSync } from 'node:fs';
import { Schema } from 'effect';

const target = Schema.Struct({
  selector: Schema.NonEmptyString,
  index: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});
export const styleProperties = [
  'fontSize',
  'lineHeight',
  'fontWeight',
  'letterSpacing',
  'colour',
  'padding',
  'radius',
  'gap',
  'height',
  'icon',
] as const;
const role = Schema.Struct({
  role: Schema.NonEmptyString,
  properties: Schema.optional(
    Schema.NonEmptyArray(Schema.Literals(styleProperties)),
  ),
  minWidth: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(320)),
  ),
  board: target,
  app: target,
});
const board = Schema.Struct({
  html: Schema.NonEmptyString,
  dark: Schema.optional(Schema.NonEmptyString),
  reveal: Schema.optional(
    Schema.NonEmptyArray(
      Schema.Struct({
        target: Schema.NonEmptyString,
        trigger: Schema.NonEmptyString,
      }),
    ),
  ),
  include: Schema.optional(Schema.NonEmptyArray(Schema.NonEmptyString)),
  roles: Schema.NonEmptyArray(role),
});
export type BoardRole = typeof role.Type;
export type BoardMap = Omit<typeof board.Type, 'include' | 'roles'> & {
  roles: readonly BoardRole[];
};

function block(markdown: string, name: string): unknown {
  const json = new RegExp('```json ' + name + '\\n([\\s\\S]*?)\\n```').exec(
    markdown,
  )?.[1];
  if (json === undefined)
    throw new Error(
      `app.board-comparison.md must contain its ${name} JSON block.`,
    );
  return JSON.parse(json);
}

export function parseBoardMaps(markdown: string): Record<string, BoardMap> {
  const sets = Schema.decodeUnknownSync(
    Schema.Record(Schema.String, Schema.NonEmptyArray(role)),
  )(block(markdown, 'board-role-sets'));
  const maps = Schema.decodeUnknownSync(Schema.Record(Schema.String, board))(
    block(markdown, 'board-maps'),
  );
  return Object.fromEntries(
    Object.entries(maps).map(([name, { include = [], ...map }]) => [
      name,
      {
        ...map,
        roles: [
          ...include.flatMap((set) => {
            const shared = Object.hasOwn(sets, set) ? sets[set] : undefined;
            if (shared === undefined)
              throw new Error(
                `Board ${name} includes unknown role set ${set}. Choose ${Object.keys(sets).join(', ')}.`,
              );
            return shared;
          }),
          ...map.roles,
        ],
      },
    ]),
  );
}

export const boards = parseBoardMaps(
  readFileSync(
    new URL('../features/app.board-comparison.md', import.meta.url),
    'utf8',
  ),
);
