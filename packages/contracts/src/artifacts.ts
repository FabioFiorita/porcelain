import { z } from 'zod';
import { worktreeIdSchema } from './worktree-id.ts';

export const artifactScopeSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
});
export const artifactAddressSchema = artifactScopeSchema.extend({
  artifactId: z.uuid(),
});
export const uploadArtifactRequestSchema = z.strictObject({
  name: z.string().min(1).max(256),
  content: z.string().min(1),
});
export const artifactMetadataSchema = z.object({
  id: z.uuid(),
  worktreeId: worktreeIdSchema,
  name: z.string(),
  sizeBytes: z.number().int().positive(),
  createdAt: z.iso.datetime(),
});
export const artifactListSchema = z.array(artifactMetadataSchema);
export const artifactContentSchema = artifactMetadataSchema.extend({
  content: z.string(),
});
export const artifactDeletionSchema = z.object({ deleted: z.boolean() });
export type ArtifactMetadataResponse = z.infer<typeof artifactMetadataSchema>;
export type ArtifactContentResponse = z.infer<typeof artifactContentSchema>;
