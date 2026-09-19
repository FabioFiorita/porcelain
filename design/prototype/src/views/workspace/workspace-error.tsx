import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { isConnectionError } from '../../query/client';
import { reviewErrorMessage } from '../../query/review';

export function WorkspaceError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queries = useQueryErrorResetBoundary();
  // Not paired (any more): the connection gate above already shows the pairing screen.
  if (isConnectionError(error)) return null;
  return (
    <div className="grid h-svh place-items-center bg-muted p-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <TriangleAlert className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Porcelain could not load your projects</EmptyTitle>
          <EmptyDescription>{reviewErrorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            onClick={() => {
              queries.reset();
              reset();
              void router.invalidate();
            }}
          >
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
