import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { PATH_LENGTH } from '../shared/limits.ts';

const reviewStatusSchema = z.enum(['pending', 'reviewed', 'replied']);

const absolutePathSchema = z
  .string()
  .min(1)
  .max(PATH_LENGTH)
  .startsWith('/')
  .refine((path) => !path.includes('\0'));

const worktreeSchema = z.object({
  id: worktreeIdSchema,
  path: z.string(),
  main: z.boolean(),
  branch: absentAsNull(z.string()),
  available: z.boolean(),
  status: absentAsNull(reviewStatusSchema),
});

const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  available: z.boolean(),
  worktrees: z.array(worktreeSchema),
});

const projectParamsSchema = z.strictObject({ projectId: z.uuid() });

export const renameProjectParamsSchema = projectParamsSchema;
export const removeProjectParamsSchema = projectParamsSchema;
export const listFilePreferencesParamsSchema = projectParamsSchema;
export const setFilePreferenceParamsSchema = projectParamsSchema;

export const readInventoryResponseSchema = z.object({
  environmentId: z.uuid(),
  projects: z.array(projectSchema),
});

export const registerProjectRequestSchema = z.strictObject({
  path: absolutePathSchema,
});
export const registerProjectResponseSchema = projectSchema;

export const removeProjectResponseSchema = z.object({ deleted: z.boolean() });

const projectLocationSchema = z.object({ name: z.string(), path: z.string() });

export const discoverProjectsResponseSchema = z.object({
  repositories: z.array(projectLocationSchema),
  limited: z.boolean(),
});

export const browseProjectFoldersQuerySchema = z.strictObject({
  path: absolutePathSchema.optional(),
});
export const browseProjectFoldersResponseSchema = z.object({
  path: z.string(),
  parent: absentAsNull(z.string()),
  directories: z.array(projectLocationSchema),
  repository: z.boolean(),
  truncated: z.boolean(),
});

export const renameProjectRequestSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), {
      message: 'The name must not contain control characters',
    }),
});
export const renameProjectResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type RenameProjectParams = z.output<typeof renameProjectParamsSchema>;
export type RemoveProjectParams = z.output<typeof removeProjectParamsSchema>;
export type ListFilePreferencesParams = z.output<
  typeof listFilePreferencesParamsSchema
>;
export type SetFilePreferenceParams = z.output<
  typeof setFilePreferenceParamsSchema
>;
export type ReadInventoryResponse = z.output<
  typeof readInventoryResponseSchema
>;
export type RegisterProjectRequest = z.output<
  typeof registerProjectRequestSchema
>;
export type RegisterProjectResponse = z.output<
  typeof registerProjectResponseSchema
>;
export type RemoveProjectResponse = z.output<
  typeof removeProjectResponseSchema
>;
export type DiscoverProjectsResponse = z.output<
  typeof discoverProjectsResponseSchema
>;
export type BrowseProjectFoldersQuery = z.output<
  typeof browseProjectFoldersQuerySchema
>;
export type BrowseProjectFoldersResponse = z.output<
  typeof browseProjectFoldersResponseSchema
>;
export type RenameProjectRequest = z.output<typeof renameProjectRequestSchema>;
export type RenameProjectResponse = z.output<
  typeof renameProjectResponseSchema
>;
