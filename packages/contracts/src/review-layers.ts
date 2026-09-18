import { z } from 'zod';

const pathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      !path.includes('\\') &&
      !path.includes('\0') &&
      !/^[A-Za-z]:/u.test(path) &&
      path
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            part.toLowerCase() !== '.git',
        ),
    'Expected a repository-relative slash-separated path',
  );
const referenceSchema = z.strictObject({
  path: pathSchema,
  scope: z.enum(['staged', 'unstaged']),
  /** One short, file-specific explanation from the agent. */
  note: z.string().max(2_000).optional(),
});
const guideSourceSchema = z
  .strictObject({
    path: pathSchema,
    startLine: z.number().int().min(1).max(1_000_000),
    endLine: z.number().int().min(1).max(1_000_000),
    /** Fingerprint returned by read_file, not review_evidence. */
    contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .refine((source) => source.endLine >= source.startLine, {
    message: 'The source range must end at or after its start',
    path: ['endLine'],
  });
const guideSchema = z
  .strictObject({
    purpose: z.string().trim().min(1).max(1_200),
    steps: z
      .array(
        z.strictObject({
          id: z.uuid(),
          title: z.string().trim().min(1).max(120),
          question: z.string().trim().min(1).max(500),
          source: guideSourceSchema,
          note: z.string().max(2_000).optional(),
          /** Agent-provided notes, never an attestation of passing checks. */
          verification: z.string().max(2_000).optional(),
          related: z
            .array(
              z.strictObject({
                title: z.string().trim().min(1).max(120),
                source: guideSourceSchema,
              }),
            )
            .max(4)
            .optional(),
        }),
      )
      .min(1)
      .max(24),
  })
  .superRefine((guide, context) => {
    const ids = new Set<string>();
    for (const [index, step] of guide.steps.entries()) {
      if (ids.has(step.id))
        context.addIssue({
          code: 'custom',
          message: 'Duplicate guide step ID',
          path: ['steps', index, 'id'],
        });
      ids.add(step.id);
    }
  });
const layerSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  /** Markdown explanation of the layer's intent. */
  summary: z.string().max(16_000).optional(),
  files: z.array(referenceSchema).max(500),
  /** A reading path through fingerprint-bound current-worktree source. */
  guide: guideSchema.optional(),
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
    const guideSources = layers.reduce(
      (total, layer) =>
        total +
        (layer.guide?.steps.reduce(
          (sum, step) => sum + 1 + (step.related?.length ?? 0),
          0,
        ) ?? 0),
      0,
    );
    if (guideSources > 1000)
      context.addIssue({ code: 'custom', message: 'Too many guide sources' });
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
