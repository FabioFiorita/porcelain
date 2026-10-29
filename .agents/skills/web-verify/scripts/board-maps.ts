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
  stock: Schema.optional(
    Schema.Struct({
      primitive: Schema.NonEmptyString,
      classes: Schema.NonEmptyArray(Schema.NonEmptyString),
    }),
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

export function parseBoardMaps(
  markdown: string,
  pinnedClasses: (primitive: string) => readonly string[] | undefined,
): Record<string, BoardMap> {
  const sets = Schema.decodeUnknownSync(
    Schema.Record(Schema.String, Schema.NonEmptyArray(role)),
  )(block(markdown, 'board-role-sets'));
  const maps = Schema.decodeUnknownSync(Schema.Record(Schema.String, board))(
    block(markdown, 'board-maps'),
  );
  return Object.fromEntries(
    Object.entries(maps).map(([name, { include = [], ...map }]) => {
      const roles = [
        ...include.flatMap((set) => {
          const shared = Object.hasOwn(sets, set) ? sets[set] : undefined;
          if (shared === undefined)
            throw new Error(
              `Board ${name} includes unknown role set ${set}. Choose ${Object.keys(sets).join(', ')}.`,
            );
          return shared;
        }),
        ...map.roles,
      ];
      const repeated = roles.find(
        (role, index) =>
          roles.findIndex((other) => other.role === role.role) !== index,
      );
      if (repeated !== undefined)
        throw new Error(
          `Board ${name} measures role ${repeated.role} twice; rows pair by role name.`,
        );
      for (const { role, stock } of roles) {
        if (stock === undefined) continue;
        const source = pinnedClasses(stock.primitive);
        if (source === undefined)
          throw new Error(
            `Role ${role} on board ${name} names ${stock.primitive} as its stock primitive, but only pinned shadcn primitives can be.`,
          );
        const foreign = stock.classes.filter(
          (token) => !source.includes(token),
        );
        if (foreign.length > 0)
          throw new Error(
            `Role ${role} on board ${name} lists ${foreign.join(', ')} as stock, but the pinned ${stock.primitive}.tsx has no such class.`,
          );
      }
      return [name, { ...map, roles }];
    }),
  );
}

const ui = new URL('../../../../apps/web/src/components/ui/', import.meta.url);
const pinned = new Set(
  Object.keys(
    Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))(
      JSON.parse(
        readFileSync(
          new URL('../../../../architecture/shadcn-pins.json', import.meta.url),
          'utf8',
        ),
      ),
    ),
  )
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => file.slice(0, -'.tsx'.length)),
);

function pinnedClasses(primitive: string): readonly string[] | undefined {
  if (!pinned.has(primitive)) return undefined;
  return [
    ...new Set(
      readFileSync(new URL(`${primitive}.tsx`, ui), 'utf8')
        .split(/\s+/)
        .map((token) => token.replace(/^["'`(]+|["'`),;]+$/g, '')),
    ),
  ];
}

export const boards = parseBoardMaps(
  readFileSync(
    new URL('../features/app.board-comparison.md', import.meta.url),
    'utf8',
  ),
  pinnedClasses,
);
