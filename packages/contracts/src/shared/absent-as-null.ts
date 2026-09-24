import { z } from 'zod';

export function absentAsNull<Schema extends z.ZodType>(schema: Schema) {
  return z.codec(schema.nullable(), z.custom<z.output<Schema> | undefined>(), {
    decode: (value) => value ?? undefined,
    encode: (value) => value ?? null,
  });
}
