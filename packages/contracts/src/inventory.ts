import { z } from 'zod';

const worktreeSchema = z.object({
  id: z.uuid(),
  path: z.string(),
  main: z.boolean(),
  branch: z.string().nullable(),
  available: z.boolean(),
});

export const projectResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  available: z.boolean(),
  worktrees: z.array(worktreeSchema),
});

export const inventoryResponseSchema = z.object({
  environmentId: z.uuid(),
  projects: z.array(projectResponseSchema),
});

export const registerProjectRequestSchema = z.strictObject({
  path: z
    .string()
    .min(1)
    .max(4096)
    .refine((path) => !path.includes('\0')),
});

export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type InventoryResponse = z.infer<typeof inventoryResponseSchema>;

export const projectParamsSchema = z.strictObject({ projectId: z.uuid() });
export const projectDeletionSchema = z.object({ deleted: z.boolean() });

const projectLocationSchema = z.object({ name: z.string(), path: z.string() });
export const projectDiscoveryResponseSchema = z.object({
  repositories: z.array(projectLocationSchema),
  limited: z.boolean(),
});
export const projectFolderResponseSchema = z.object({
  path: z.string(),
  parent: z.string().nullable(),
  directories: z.array(projectLocationSchema),
  repository: z.boolean(),
  truncated: z.boolean(),
});
export const projectFolderQuerySchema = z.strictObject({
  path: registerProjectRequestSchema.shape.path.optional(),
});
export type ProjectDiscoveryResponse = z.infer<
  typeof projectDiscoveryResponseSchema
>;
export type ProjectFolderResponse = z.infer<typeof projectFolderResponseSchema>;
