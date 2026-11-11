import { describe, expect, it } from 'vitest';
import { Predicate, Schema } from 'effect';
import { walkthroughContentSchema } from '@porcelain/contracts/walkthroughs';
import { firstPassSchema } from './writing-prompts.ts';
import { codexOutputSchema } from './codex-output-schema.ts';

const supported = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'anyOf',
  'enum',
  'const',
  '$ref',
  '$defs',
  'description',
  'title',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
]);
const strict = (node: unknown): void => {
  expect(Predicate.isObject(node)).toBe(true);
  if (!Predicate.isObject(node)) return;
  expect(Object.keys(node).filter((key) => !supported.has(key))).toEqual([]);
  if (node.type === 'object') {
    expect(node.additionalProperties).toBe(false);
    expect(node.required).toEqual(Object.keys(node.properties ?? {}));
  }
  for (const key of ['properties', '$defs'])
    if (Predicate.isObject(node[key])) Object.values(node[key]).forEach(strict);
  if (node.items !== undefined) strict(node.items);
  if (Array.isArray(node.anyOf)) node.anyOf.forEach(strict);
};

describe('Codex writer output formats', () => {
  it.each([
    ['first pass', firstPassSchema],
    ['content', walkthroughContentSchema],
  ] as const)(
    '%s satisfies strict structured output at every level',
    (_name, schema) => {
      strict(codexOutputSchema(schema));
    },
  );

  it('decodes null for an absent optional back to the canonical value', () => {
    const schema = Schema.Struct({ question: Schema.optional(Schema.String) });
    strict(codexOutputSchema(schema));
    expect(
      Schema.decodeUnknownSync(Schema.toCodecJson(schema))({ question: null }),
    ).toEqual({ question: undefined });
  });
});
