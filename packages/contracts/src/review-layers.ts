import { z } from 'zod';

const pathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !/[\\:]/u.test(path) &&
      [...path].every(
        (character) =>
          character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ) &&
      path
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Expected a repository-relative slash-separated path',
  );
const referenceSchema = z.strictObject({
  path: pathSchema,
  scope: z.enum(['staged', 'unstaged']),
});
const layerSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  files: z.array(referenceSchema).max(500),
});
// Array indexes are the explicit, canonical layer and reference positions.
const layersSchema = z
  .array(layerSchema)
  .max(100)
  .superRefine((layers, context) => {
    const ids = new Set<string>();
    const references = new Set<string>();
    const count = layers.reduce(
      (total, layer) => total + layer.files.length,
      0,
    );
    if (count > 2000)
      context.addIssue({ code: 'custom', message: 'Too many references' });
    for (const layer of layers) {
      if (ids.has(layer.id))
        context.addIssue({ code: 'custom', message: 'Duplicate layer ID' });
      ids.add(layer.id);
      for (const file of layer.files) {
        const key = JSON.stringify([file.path, file.scope]);
        if (references.has(key))
          context.addIssue({ code: 'custom', message: 'Duplicate reference' });
        references.add(key);
      }
    }
  });
export const reviewLayerParamsSchema = z.strictObject({ worktreeId: z.uuid() });
export const replaceReviewLayersSchema = z.strictObject({
  expectedRevision: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER - 1),
  layers: layersSchema,
});
export const reviewLayersResponseSchema = z.strictObject({
  worktreeId: z.uuid(),
  revision: z.number().int().nonnegative(),
  layers: layersSchema,
});
