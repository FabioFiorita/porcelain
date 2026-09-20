import { z } from 'zod';
import { worktreeIdSchema } from './worktree-id.ts';

const worktreeSchema = z.object({
  id: worktreeIdSchema,
  path: z.string(),
  main: z.boolean(),
  branch: z.string().nullable(),
  available: z.boolean(),
  /**
   * What this worktree has to say for itself: `pending` (published layers with
   * something still unreviewed), `reviewed` (all of them marked, waiting for a
   * commit), `replied` (the agent answered and it has not been seen), or
   * nothing. Named by meaning, not by appearance — how a client draws it is
   * its own business. Read from the database with the list, so it costs no
   * request and no Git.
   */
  status: z.enum(['pending', 'reviewed', 'replied']).nullable(),
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

export const renameProjectRequestSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    // A name is a label in a sidebar; control characters are not one.
    .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), {
      message: 'The name must not contain control characters',
    }),
});
export const projectNameResponseSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
});
