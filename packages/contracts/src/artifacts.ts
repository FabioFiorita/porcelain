import { z } from 'zod';

export const artifactScopeSchema = z.strictObject({ worktreeId: z.uuid() });
export const artifactAddressSchema = artifactScopeSchema.extend({
  artifactId: z.uuid(),
});
export const uploadArtifactRequestSchema = z.strictObject({
  name: z.string().min(1).max(256),
  content: z.string().min(1),
});
export const artifactMetadataSchema = z.object({
  id: z.uuid(),
  worktreeId: z.uuid(),
  name: z.string(),
  sizeBytes: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export const artifactListSchema = z.array(artifactMetadataSchema);
export const artifactContentSchema = artifactMetadataSchema.extend({
  content: z.string(),
});
export const artifactDeletionSchema = z.object({ deleted: z.boolean() });
export type ArtifactMetadataResponse = z.infer<typeof artifactMetadataSchema>;
export type ArtifactContentResponse = z.infer<typeof artifactContentSchema>;
