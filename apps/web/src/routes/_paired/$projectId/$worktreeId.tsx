import { Schema } from 'effect';
import { createFileRoute } from '@tanstack/react-router';
import { workspaceSearchSchema } from '@/shared/workspace/search';

export const Route = createFileRoute('/_paired/$projectId/$worktreeId')({
  validateSearch: Schema.decodeUnknownSync(workspaceSearchSchema),
});
