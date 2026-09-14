// @vitest-environment jsdom
import { QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { Component, type ReactNode, Suspense } from 'react';
import { expect, it } from 'vitest';
import { createQueryClient } from '../../query/client';
import { WorkspaceError } from './workspace-error';

class TestBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (this.state.error)
      return (
        <WorkspaceError
          error={this.state.error}
          reset={() => this.setState({ error: null })}
        />
      );
    return this.props.children;
  }
}

function RecoveringQuery({ read }: { read: () => string }) {
  const { data } = useSuspenseQuery({ queryKey: ['recovery'], queryFn: read });
  return <p>{data}</p>;
}

it('retries a failed workspace query when the window becomes active', async () => {
  let attempts = 0;
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <TestBoundary>
        <Suspense fallback={<p>Loading</p>}>
          <RecoveringQuery
            read={() => {
              attempts += 1;
              if (attempts === 1) throw new Error('Unavailable');
              return 'Workspace recovered';
            }}
          />
        </Suspense>
      </TestBoundary>
    </QueryClientProvider>,
  );

  await screen.findByRole('alert');
  fireEvent.focus(window);
  expect(await screen.findByText('Workspace recovered')).toBeTruthy();
  expect(attempts).toBe(2);
});
