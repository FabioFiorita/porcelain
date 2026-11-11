import { Predicate, Schema } from 'effect';

const requireProperties = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(requireProperties);
  if (!Predicate.isObject(value)) return value;
  const result = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      requireProperties(child),
    ]),
  );
  if (value.type === 'object' && Predicate.isObject(value.properties))
    result.required = Object.keys(value.properties);
  return result;
};

export const codexOutputSchema = (schema: Schema.Top) => {
  const document = Schema.toJsonSchemaDocument(schema, {
    onExcessProperty: 'error',
  });
  return requireProperties({
    ...document.schema,
    ...(Object.keys(document.definitions).length > 0
      ? { $defs: document.definitions }
      : {}),
  });
};
