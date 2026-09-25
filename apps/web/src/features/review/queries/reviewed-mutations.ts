import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ReviewChangeItem,
  ReviewScope,
  SetReviewedRequest,
} from '../model/review';
import { isFingerprintable } from '../model/review';
import { queryKeys } from '@/shared/query/keys';
import { asMutation } from '@/shared/query/mutation';
import { enqueueReviewed, enqueueReviewedMany } from './reviewed-queue';
import { useConnectedContext } from '@/app/workspace-provider';

function useReviewedContext(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    api: api.review.reviewed,
    key: queryKeys.reviewSurface(connection.environmentId, scope, ['reviewed']),
    inventoryKey: queryKeys.inventory(connection.environmentId),
    changesKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    scope,
    connection,
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
    }),
  };
}

export type MarkReviewedInput = Pick<
  SetReviewedRequest,
  'path' | 'fingerprint'
>;

export function useMarkReviewed(scope: ReviewScope) {
  const context = useReviewedContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (input: MarkReviewedInput) =>
        enqueueReviewed(context, client, input, async () => {
          const request = context.request();
          const result = await context.api.set({
            ...request,
            input: { ...input, reviewed: true },
          });
          request.signal.throwIfAborted();
          return result;
        }),
    }),
  );
}

export function useUnmarkReviewed(scope: ReviewScope) {
  const context = useReviewedContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (path: string) =>
        enqueueReviewed(context, client, { path }, async () => {
          const request = context.request();
          const result = await context.api.remove({ ...request, path });
          request.signal.throwIfAborted();
          return result;
        }),
    }),
  );
}

export type BulkReviewReport = {
  marked: string[];
  skipped: Array<{
    path: string;
    reason: 'not-fingerprintable' | 'already-reviewed';
  }>;
  failed: Array<{ path: string; error: unknown }>;
};

export function useMarkAllReviewed(scope: ReviewScope) {
  const context = useReviewedContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: async (
        entries: readonly ReviewChangeItem[],
      ): Promise<BulkReviewReport> => {
        const report: BulkReviewReport = {
          marked: [],
          skipped: [],
          failed: [],
        };
        const uniqueEntries = [
          ...new Map(entries.map((entry) => [entry.path, entry])).values(),
        ];
        const files: { path: string; fingerprint: string }[] = [];
        for (const entry of uniqueEntries) {
          if (entry.reviewStatus === 'reviewed') {
            report.skipped.push({
              path: entry.path,
              reason: 'already-reviewed',
            });
            continue;
          }
          if (!isFingerprintable(entry) || entry.fingerprint == null) {
            report.skipped.push({
              path: entry.path,
              reason: 'not-fingerprintable',
            });
            continue;
          }
          files.push({ path: entry.path, fingerprint: entry.fingerprint });
        }
        if (files.length === 0) return report;
        const response = await enqueueReviewedMany(
          context,
          client,
          files,
          async () => {
            const request = context.request();
            const result = await context.api.setAll({
              ...request,
              input: { files },
            });
            request.signal.throwIfAborted();
            return result;
          },
        );
        report.marked.push(...response.marked);
        for (const conflict of response.conflicts)
          report.failed.push({
            path: conflict.path,
            error: new Error(
              conflict.reason === 'missing'
                ? 'That file is no longer in the change list.'
                : 'The file changed since it was shown.',
            ),
          });
        return report;
      },
    }),
  );
}
