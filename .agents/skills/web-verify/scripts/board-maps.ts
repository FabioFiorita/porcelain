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
  roles: Schema.NonEmptyArray(role),
});
export type BoardRole = typeof role.Type;
export type BoardMap = typeof board.Type;
const markdown = readFileSync(
  new URL('../features/app.board-comparison.md', import.meta.url),
  'utf8',
);
const json = /```json board-maps\n([\s\S]*?)\n```/.exec(markdown)?.[1];
if (json === undefined)
  throw new Error(
    'app.board-comparison.md must contain its board-maps JSON block.',
  );
export const boards = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, board),
)(JSON.parse(json));
